mod common;

use common::{ft_balance, paid_join_fixture};
use near_sdk::json_types::U128;
use near_workspaces::types::NearToken;
use serde_json::json;

async fn expect_full_refund(msg: String, amount: u128) -> anyhow::Result<()> {
    let fixture = paid_join_fixture(1_000_000, 5_000_000).await?;
    let before = ft_balance(&fixture.token, fixture.member.id().as_str()).await?;

    fixture
        .member
        .call(fixture.token.id(), "ft_transfer_call")
        .args_json(json!({
            "receiver_id": fixture.contract.id(),
            "amount": U128(amount),
            "memo": null,
            "msg": msg,
        }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    assert_eq!(
        ft_balance(&fixture.token, fixture.member.id().as_str()).await?,
        before,
        "sender must be fully refunded"
    );
    assert_eq!(
        ft_balance(&fixture.token, fixture.contract.id().as_str()).await?,
        0,
        "GroupVault must retain nothing"
    );

    let is_member: bool = fixture
        .contract
        .view("is_member")
        .args_json(json!({
            "group_id": fixture.group_id,
            "account_id": fixture.member.id(),
        }))
        .await?
        .json()?;
    assert!(!is_member, "refund must not create membership");

    let fees: U128 = fixture
        .contract
        .view("get_join_fee_balance")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert_eq!(fees.0, 0, "refund must not credit accounting");

    Ok(())
}

#[tokio::test]
async fn underpayment_is_fully_refunded() -> anyhow::Result<()> {
    let msg = json!({ "action": "join", "group_id": 0 }).to_string();
    expect_full_refund(msg, 999_999).await
}

#[tokio::test]
async fn malformed_message_is_fully_refunded() -> anyhow::Result<()> {
    expect_full_refund("not-json".to_string(), 1_000_000).await
}

#[tokio::test]
async fn wrong_action_is_fully_refunded() -> anyhow::Result<()> {
    let msg = json!({ "action": "leave", "group_id": 0 }).to_string();
    expect_full_refund(msg, 1_000_000).await
}

#[tokio::test]
async fn missing_group_is_fully_refunded() -> anyhow::Result<()> {
    let msg = json!({ "action": "join", "group_id": 42 }).to_string();
    expect_full_refund(msg, 1_000_000).await
}

#[tokio::test]
async fn direct_callback_outside_configured_ft_is_fully_refunded() -> anyhow::Result<()> {
    let fixture = paid_join_fixture(1_000_000, 5_000_000).await?;

    // Call ft_on_transfer directly, i.e. with a predecessor that is not the
    // configured join FT. NEP-141 requires the full amount back.
    let unused: U128 = fixture
        .member
        .call(fixture.contract.id(), "ft_on_transfer")
        .args_json(json!({
            "sender_id": fixture.member.id(),
            "amount": U128(1_000_000),
            "msg": json!({ "action": "join", "group_id": fixture.group_id }).to_string(),
        }))
        .max_gas()
        .transact()
        .await?
        .json()?;
    assert_eq!(unused.0, 1_000_000);

    let is_member: bool = fixture
        .contract
        .view("is_member")
        .args_json(json!({
            "group_id": fixture.group_id,
            "account_id": fixture.member.id(),
        }))
        .await?
        .json()?;
    assert!(!is_member);
    Ok(())
}

#[tokio::test]
async fn duplicate_join_is_fully_refunded() -> anyhow::Result<()> {
    let fixture = paid_join_fixture(1_000_000, 5_000_000).await?;
    let msg = json!({ "action": "join", "group_id": fixture.group_id }).to_string();

    fixture
        .member
        .call(fixture.token.id(), "ft_transfer_call")
        .args_json(json!({
            "receiver_id": fixture.contract.id(),
            "amount": U128(1_000_000),
            "memo": null,
            "msg": msg.clone(),
        }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let before = ft_balance(&fixture.token, fixture.member.id().as_str()).await?;
    fixture
        .member
        .call(fixture.token.id(), "ft_transfer_call")
        .args_json(json!({
            "receiver_id": fixture.contract.id(),
            "amount": U128(1_000_000),
            "memo": null,
            "msg": msg,
        }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    assert_eq!(
        ft_balance(&fixture.token, fixture.member.id().as_str()).await?,
        before,
        "duplicate join must refund"
    );
    let fees: U128 = fixture
        .contract
        .view("get_join_fee_balance")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert_eq!(fees.0, 1_000_000, "only the first join is credited");
    Ok(())
}

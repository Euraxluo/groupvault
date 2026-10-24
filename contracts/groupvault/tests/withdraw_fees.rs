mod common;

use common::{ft_balance, join_msg, paid_join_fixture, Fixture};
use near_sdk::json_types::U128;
use near_workspaces::types::NearToken;
use serde_json::json;

async fn joined_fixture() -> anyhow::Result<Fixture> {
    let fixture = paid_join_fixture(1_000_000, 5_000_000).await?;
    join_msg(&fixture, 1_000_000).await?.into_result()?;
    Ok(fixture)
}

#[tokio::test]
async fn owner_withdraws_join_fees_and_accounting_matches() -> anyhow::Result<()> {
    let fixture = joined_fixture().await?;
    let before = ft_balance(&fixture.token, fixture.owner.id().as_str()).await?;

    fixture
        .owner
        .call(fixture.contract.id(), "withdraw_join_fees")
        .args_json(json!({ "group_id": fixture.group_id, "amount": U128(400_000) }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let fees: U128 = fixture
        .contract
        .view("get_join_fee_balance")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert_eq!(fees.0, 600_000);
    assert_eq!(
        ft_balance(&fixture.token, fixture.owner.id().as_str()).await?,
        before + 400_000
    );
    Ok(())
}

#[tokio::test]
async fn non_owner_cannot_withdraw() -> anyhow::Result<()> {
    let fixture = joined_fixture().await?;

    let outcome = fixture
        .member
        .call(fixture.contract.id(), "withdraw_join_fees")
        .args_json(json!({ "group_id": fixture.group_id, "amount": U128(1) }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_failure());
    assert!(outcome
        .into_result()
        .expect_err("member cannot withdraw")
        .to_string()
        .contains("ERR_NOT_GROUP_OWNER"));
    Ok(())
}

#[tokio::test]
async fn over_withdraw_is_rejected_without_accounting_change() -> anyhow::Result<()> {
    let fixture = joined_fixture().await?;

    let outcome = fixture
        .owner
        .call(fixture.contract.id(), "withdraw_join_fees")
        .args_json(json!({ "group_id": fixture.group_id, "amount": U128(2_000_000) }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_failure());
    assert!(outcome
        .into_result()
        .expect_err("cannot over-withdraw")
        .to_string()
        .contains("ERR_INSUFFICIENT_JOIN_FEES"));

    let fees: U128 = fixture
        .contract
        .view("get_join_fee_balance")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert_eq!(fees.0, 1_000_000);
    Ok(())
}

#[tokio::test]
async fn failed_ft_transfer_does_not_debit_accounting() -> anyhow::Result<()> {
    let fixture = joined_fixture().await?;

    fixture
        .root
        .call(fixture.token.id(), "set_fail_transfers")
        .args_json(json!({ "fail": true }))
        .transact()
        .await?
        .into_result()?;

    let before_owner = ft_balance(&fixture.token, fixture.owner.id().as_str()).await?;
    fixture
        .owner
        .call(fixture.contract.id(), "withdraw_join_fees")
        .args_json(json!({ "group_id": fixture.group_id, "amount": U128(400_000) }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let fees: U128 = fixture
        .contract
        .view("get_join_fee_balance")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert_eq!(fees.0, 1_000_000, "failed transfer must not debit fees");
    assert_eq!(
        ft_balance(&fixture.token, fixture.owner.id().as_str()).await?,
        before_owner,
        "failed transfer must not pay the owner"
    );
    Ok(())
}

#[tokio::test]
async fn withdrawal_does_not_touch_dao_or_members() -> anyhow::Result<()> {
    let fixture = joined_fixture().await?;

    fixture
        .owner
        .call(fixture.contract.id(), "withdraw_join_fees")
        .args_json(json!({ "group_id": fixture.group_id, "amount": U128(100_000) }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let dao_id: Option<String> = fixture
        .contract
        .view("get_dao_id")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert!(dao_id.is_none());

    let members: Vec<String> = fixture
        .contract
        .view("get_members")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert_eq!(members.len(), 2);
    Ok(())
}

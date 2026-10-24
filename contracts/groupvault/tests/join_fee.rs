mod common;

use common::{ft_balance, join_msg, paid_join_fixture};
use near_sdk::json_types::U128;
use near_workspaces::types::NearToken;
use serde_json::json;

#[tokio::test]
async fn join_with_exact_ft_succeeds_and_credits_fees() -> anyhow::Result<()> {
    let fixture = paid_join_fixture(1_000_000, 5_000_000).await?;
    join_msg(&fixture, 1_000_000).await?.into_result()?;

    let is_member: bool = fixture
        .contract
        .view("is_member")
        .args_json(json!({
            "group_id": fixture.group_id,
            "account_id": fixture.member.id(),
        }))
        .await?
        .json()?;
    assert!(is_member);

    let balance: U128 = fixture
        .contract
        .view("get_join_fee_balance")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert_eq!(balance.0, 1_000_000);

    assert_eq!(
        ft_balance(&fixture.token, fixture.member.id().as_str()).await?,
        4_000_000
    );
    assert_eq!(
        ft_balance(&fixture.token, fixture.contract.id().as_str()).await?,
        1_000_000
    );

    let members: Vec<String> = fixture
        .contract
        .view("get_members")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert_eq!(
        members,
        vec![
            fixture.owner.id().to_string(),
            fixture.member.id().to_string()
        ]
    );

    // A paid join must not create DAO/staking side effects.
    let dao_id: Option<String> = fixture
        .contract
        .view("get_dao_id")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert!(dao_id.is_none());

    let group: serde_json::Value = fixture
        .contract
        .view("get_group")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert_eq!(group["convert_pending"], false);

    Ok(())
}

#[tokio::test]
async fn join_overpayment_accepts_all_sent_tokens() -> anyhow::Result<()> {
    let fixture = paid_join_fixture(1_000_000, 5_000_000).await?;
    join_msg(&fixture, 2_500_000).await?.into_result()?;

    let balance: U128 = fixture
        .contract
        .view("get_join_fee_balance")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert_eq!(balance.0, 2_500_000);
    Ok(())
}

#[tokio::test]
async fn owner_duplicate_join_is_refunded() -> anyhow::Result<()> {
    let fixture = paid_join_fixture(1_000_000, 5_000_000).await?;
    let before = ft_balance(&fixture.token, fixture.owner.id().as_str()).await?;

    fixture
        .owner
        .call(fixture.token.id(), "ft_transfer_call")
        .args_json(json!({
            "receiver_id": fixture.contract.id(),
            "amount": U128(1_000_000),
            "memo": null,
            "msg": json!({ "action": "join", "group_id": fixture.group_id }).to_string(),
        }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    // The owner is already a member, so the join is refunded and not credited.
    assert_eq!(
        ft_balance(&fixture.token, fixture.owner.id().as_str()).await?,
        before
    );
    let fees: U128 = fixture
        .contract
        .view("get_join_fee_balance")
        .args_json(json!({ "group_id": fixture.group_id }))
        .await?
        .json()?;
    assert_eq!(fees.0, 0);
    Ok(())
}

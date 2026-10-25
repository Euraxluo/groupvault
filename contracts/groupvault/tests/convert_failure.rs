mod common;

use near_workspaces::types::NearToken;
use serde_json::{json, Value};

async fn converted_group(
    mode: &str,
) -> anyhow::Result<(
    near_workspaces::Contract,
    near_workspaces::Contract,
    near_workspaces::Account,
    u64,
)> {
    let worker = near_workspaces::sandbox().await?;
    let factory = common::deploy_factory(&worker, mode).await?;
    let contract = common::deploy_with_factory(&worker, factory.id().as_str()).await;
    let owner = worker.dev_create_account().await?;
    let member = worker.dev_create_account().await?;

    let group_id: u64 = owner
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": "Builders",
            "description": "",
            "join_fee": "1",
            "join_ft": "ft.testnet",
            "initial_members": [member.id()],
        }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await?
        .json()?;

    Ok((contract, factory, owner, group_id))
}

async fn run_convert(mode: &str) -> anyhow::Result<(near_workspaces::Contract, u64)> {
    let (contract, _factory, owner, group_id) = converted_group(mode).await?;
    owner
        .call(contract.id(), "convert_to_dao")
        .args_json(json!({
            "group_id": group_id,
            "dao_name": "builders",
            "purpose": "paid group",
        }))
        .deposit(NearToken::from_near(5))
        .max_gas()
        .transact()
        .await?
        .into_result()?;
    Ok((contract, group_id))
}

#[tokio::test]
async fn factory_false_clears_pending_without_dao_id() -> anyhow::Result<()> {
    let (contract, group_id) = run_convert("ReturnFalse").await?;
    let group: Value = contract
        .view("get_group")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    assert_eq!(group["dao_id"], Value::Null);
    assert_eq!(group["convert_pending"], false);
    Ok(())
}

#[tokio::test]
async fn factory_failure_clears_pending_without_dao_id() -> anyhow::Result<()> {
    let (contract, group_id) = run_convert("Fail").await?;
    let group: Value = contract
        .view("get_group")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    assert_eq!(group["dao_id"], Value::Null);
    assert_eq!(group["convert_pending"], false);
    Ok(())
}

#[tokio::test]
async fn malformed_factory_payload_is_not_success() -> anyhow::Result<()> {
    let (contract, group_id) = run_convert("ReturnMalformed").await?;
    let group: Value = contract
        .view("get_group")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    assert_eq!(group["dao_id"], Value::Null);
    assert_eq!(group["convert_pending"], false);
    Ok(())
}

#[tokio::test]
async fn retry_after_failure_is_allowed() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let factory = common::deploy_factory(&worker, "ReturnFalse").await?;
    let contract = common::deploy_with_factory(&worker, factory.id().as_str()).await;
    let owner = worker.dev_create_account().await?;

    let group_id: u64 = owner
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": "Retry",
            "description": "",
            "join_fee": "1",
            "join_ft": "ft.testnet",
            "initial_members": [],
        }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await?
        .json()?;

    for _ in 0..2 {
        owner
            .call(contract.id(), "convert_to_dao")
            .args_json(json!({
                "group_id": group_id,
                "dao_name": "retry",
                "purpose": "",
            }))
            .deposit(NearToken::from_near(5))
            .max_gas()
            .transact()
            .await?
            .into_result()?;
    }

    factory
        .as_account()
        .call(factory.id(), "set_mode")
        .args_json(json!({ "mode": "Succeed" }))
        .transact()
        .await?
        .into_result()?;

    owner
        .call(contract.id(), "convert_to_dao")
        .args_json(json!({
            "group_id": group_id,
            "dao_name": "retry",
            "purpose": "",
        }))
        .deposit(NearToken::from_near(5))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let dao_id: Option<String> = contract
        .view("get_dao_id")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    assert_eq!(
        dao_id.as_deref(),
        Some(format!("retry.{}", factory.id()).as_str())
    );
    Ok(())
}

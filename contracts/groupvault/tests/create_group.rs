mod common;

use near_workspaces::types::NearToken;
use serde_json::{json, Value};

#[tokio::test]
async fn create_group_returns_id_and_owner_is_member_once() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let contract = common::deploy(&worker).await;
    let owner = worker.dev_create_account().await?;
    let bob = worker.dev_create_account().await?;

    let outcome = owner
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": "Builders",
            "description": "paid builders",
            "join_fee": "1000000",
            "join_ft": "ft.testnet",
            "initial_members": [bob.id(), owner.id()],
        }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await?;
    let group_id: u64 = outcome.json()?;

    let members: Vec<String> = contract
        .view("get_members")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;

    assert_eq!(members, vec![owner.id().to_string(), bob.id().to_string()]);

    let group: Value = contract
        .view("get_group")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    assert_eq!(group["owner"], owner.id().as_str());
    assert_eq!(group["dao_id"], Value::Null);
    assert_eq!(group["convert_pending"], false);
    assert_eq!(group["member_count"], 2);
    assert_eq!(group["join_fee"], "1000000");

    let dao_id: Option<String> = contract
        .view("get_dao_id")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    assert!(dao_id.is_none());

    Ok(())
}

#[tokio::test]
async fn create_group_rejects_empty_name() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let contract = common::deploy(&worker).await;

    let outcome = contract
        .call("create_group")
        .args_json(json!({
            "name": "   ",
            "description": "",
            "join_fee": "1",
            "join_ft": "ft.testnet",
            "initial_members": [],
        }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await?;

    assert!(outcome.is_failure());
    assert!(outcome
        .into_result()
        .expect_err("empty name must fail")
        .to_string()
        .contains("ERR_EMPTY_NAME"));
    Ok(())
}

#[tokio::test]
async fn create_group_rejects_more_than_fifty_members() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let contract = common::deploy(&worker).await;
    let valid_members: Vec<String> = (0..49).map(|index| format!("m{index}.testnet")).collect();
    let outcome = contract
        .call("create_group")
        .args_json(json!({
            "name": "Too many",
            "description": "",
            "join_fee": "1",
            "join_ft": "ft.testnet",
            "initial_members": valid_members,
        }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_success());

    let extra: Vec<String> = (0..50).map(|index| format!("x{index}.testnet")).collect();
    let outcome = worker
        .root_account()?
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": "Too many",
            "description": "",
            "join_fee": "1",
            "join_ft": "ft.testnet",
            "initial_members": extra,
        }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_failure());
    assert!(outcome
        .into_result()
        .expect_err("50 initial members plus owner must fail")
        .to_string()
        .contains("ERR_MEMBERS_EXCEEDED"));
    Ok(())
}

#[tokio::test]
async fn create_group_requires_storage_deposit() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let contract = common::deploy(&worker).await;

    let outcome = worker
        .root_account()?
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": "No deposit",
            "description": "",
            "join_fee": "1",
            "join_ft": "ft.testnet",
            "initial_members": [],
        }))
        .transact()
        .await?;

    assert!(outcome.is_failure());
    Ok(())
}

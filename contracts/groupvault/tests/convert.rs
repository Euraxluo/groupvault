mod common;

use near_sdk::base64::Engine;
use near_workspaces::types::NearToken;
use serde_json::{json, Value};

#[tokio::test]
async fn convert_calls_factory_once_and_writes_dao_id_after_true() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let factory = common::deploy_factory(&worker, "Succeed").await?;
    let contract = common::deploy_with_factory(&worker, factory.id().as_str()).await;
    let owner = worker.dev_create_account().await?;
    let member = worker.dev_create_account().await?;

    let outcome = owner
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": "Builders",
            "description": "convert me",
            "join_fee": "1000000",
            "join_ft": "ft.testnet",
            "initial_members": [member.id()],
        }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await?;
    let group_id: u64 = outcome.json()?;

    let outcome = owner
        .call(contract.id(), "convert_to_dao")
        .args_json(json!({
            "group_id": group_id,
            "dao_name": "builders",
            "purpose": "paid group",
        }))
        .deposit(NearToken::from_near(10))
        .max_gas()
        .transact()
        .await?;
    let result = outcome.into_result()?;

    let logs: Vec<Value> = result
        .logs()
        .iter()
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();
    assert!(
        logs.iter().any(|value| value["event"] == "convert_done"),
        "convert_done must be emitted"
    );

    let dao_id: Option<String> = contract
        .view("get_dao_id")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    assert_eq!(
        dao_id.as_deref(),
        Some(format!("builders.{}", factory.id()).as_str())
    );

    let group: Value = contract
        .view("get_group")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    assert_eq!(group["convert_pending"], false);

    let call: Value = factory
        .view("last_call")
        .await?
        .json::<Option<Value>>()?
        .expect("factory must be called");
    assert_eq!(call["name"], "builders");
    assert_eq!(call["predecessor"], contract.id().as_str());
    assert_eq!(
        call["deposit"],
        NearToken::from_near(10).as_yoctonear().to_string()
    );

    let inner = near_sdk::base64::engine::general_purpose::STANDARD
        .decode(call["args"].as_str().unwrap())?;
    let inner: Value = serde_json::from_slice(&inner)?;
    assert_eq!(inner["config"]["name"], "builders");
    assert_eq!(inner["config"]["purpose"], "paid group");
    assert_eq!(inner["config"]["metadata"], "");
    assert_eq!(
        inner["policy"],
        json!([owner.id(), member.id()]),
        "current members are the council snapshot"
    );

    Ok(())
}

#[tokio::test]
async fn non_owner_cannot_convert() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let factory = common::deploy_factory(&worker, "Succeed").await?;
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

    let outcome = member
        .call(contract.id(), "convert_to_dao")
        .args_json(json!({
            "group_id": group_id,
            "dao_name": "builders",
            "purpose": "",
        }))
        .deposit(NearToken::from_near(10))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_failure());
    assert!(outcome
        .into_result()
        .expect_err("non owner cannot convert")
        .to_string()
        .contains("ERR_NOT_GROUP_OWNER"));
    Ok(())
}

#[tokio::test]
async fn convert_requires_ten_near_deposit() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let factory = common::deploy_factory(&worker, "Succeed").await?;
    let contract = common::deploy_with_factory(&worker, factory.id().as_str()).await;
    let owner = worker.dev_create_account().await?;

    let group_id: u64 = owner
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": "Builders",
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

    let outcome = owner
        .call(contract.id(), "convert_to_dao")
        .args_json(json!({
            "group_id": group_id,
            "dao_name": "builders",
            "purpose": "",
        }))
        .deposit(NearToken::from_near(9))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_failure());
    assert!(outcome
        .into_result()
        .expect_err("underfunded convert must fail")
        .to_string()
        .contains("ERR_CONVERT_DEPOSIT"));

    let group: Value = contract
        .view("get_group")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    assert_eq!(group["convert_pending"], false);
    assert_eq!(group["dao_id"], Value::Null);
    Ok(())
}

#[tokio::test]
async fn invalid_dao_name_is_rejected_before_factory_call() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let factory = common::deploy_factory(&worker, "Succeed").await?;
    let contract = common::deploy_with_factory(&worker, factory.id().as_str()).await;
    let owner = worker.dev_create_account().await?;

    let group_id: u64 = owner
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": "Builders",
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

    let outcome = owner
        .call(contract.id(), "convert_to_dao")
        .args_json(json!({
            "group_id": group_id,
            "dao_name": "Bad.Name",
            "purpose": "",
        }))
        .deposit(NearToken::from_near(10))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_failure());

    let call: Option<Value> = factory.view("last_call").await?.json()?;
    assert!(call.is_none(), "factory must not be called");
    Ok(())
}

#[tokio::test]
async fn convert_does_not_sweep_join_fees_into_the_dao() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let factory = common::deploy_factory(&worker, "Succeed").await?;
    let token = common::deploy_token(&worker).await;
    let contract = common::deploy_with_factory(&worker, factory.id().as_str()).await;
    let owner = worker.dev_create_account().await?;
    let member = worker.dev_create_account().await?;
    let root = worker.root_account()?;
    common::register(&token, &root, owner.id()).await;
    common::register(&token, &root, member.id()).await;
    common::register(&token, &root, contract.id()).await;
    common::mint(&token, &root, &member, 5_000_000).await;

    let group_id: u64 = owner
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": "Fees Stay",
            "description": "",
            "join_fee": "1000000",
            "join_ft": token.id(),
            "initial_members": [],
        }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await?
        .json()?;

    member
        .call(token.id(), "ft_transfer_call")
        .args_json(json!({
            "receiver_id": contract.id(),
            "amount": "1000000",
            "memo": null,
            "msg": json!({ "action": "join", "group_id": group_id }).to_string(),
        }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let fees_before: near_sdk::json_types::U128 = contract
        .view("get_join_fee_balance")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    let vault_ft_before = common::ft_balance(&token, contract.id().as_str()).await?;

    owner
        .call(contract.id(), "convert_to_dao")
        .args_json(json!({
            "group_id": group_id,
            "dao_name": "fees-stay",
            "purpose": "",
        }))
        .deposit(NearToken::from_near(10))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let fees_after: near_sdk::json_types::U128 = contract
        .view("get_join_fee_balance")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    assert_eq!(fees_before.0, 1_000_000);
    assert_eq!(fees_after.0, fees_before.0);
    assert_eq!(
        common::ft_balance(&token, contract.id().as_str()).await?,
        vault_ft_before,
        "Convert must not move join-fee FT balances"
    );
    assert_eq!(
        common::ft_balance(&token, factory.id().as_str()).await?,
        0,
        "factory receives only NEAR"
    );
    Ok(())
}

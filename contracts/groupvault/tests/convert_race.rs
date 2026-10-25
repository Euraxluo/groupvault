mod common;

use near_workspaces::types::NearToken;
use serde_json::json;

async fn setup() -> anyhow::Result<(
    near_workspaces::Worker<near_workspaces::network::Sandbox>,
    near_workspaces::Contract,
    near_workspaces::Contract,
    near_workspaces::Account,
    u64,
)> {
    let worker = near_workspaces::sandbox().await?;
    let factory = common::deploy_factory(&worker, "Succeed").await?;
    let contract = common::deploy_with_factory(&worker, factory.id().as_str()).await;
    let owner = worker.dev_create_account().await?;

    let group_id: u64 = owner
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": "Race",
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

    Ok((worker, contract, factory, owner, group_id))
}

#[tokio::test]
async fn second_convert_after_success_is_rejected() -> anyhow::Result<()> {
    let (_worker, contract, _factory, owner, group_id) = setup().await?;

    owner
        .call(contract.id(), "convert_to_dao")
        .args_json(json!({
            "group_id": group_id,
            "dao_name": "race",
            "purpose": "",
        }))
        .deposit(NearToken::from_near(5))
        .max_gas()
        .transact()
        .await?
        .into_result()?;

    let outcome = owner
        .call(contract.id(), "convert_to_dao")
        .args_json(json!({
            "group_id": group_id,
            "dao_name": "race",
            "purpose": "",
        }))
        .deposit(NearToken::from_near(5))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_failure());
    let error = outcome
        .into_result()
        .expect_err("second convert must fail")
        .to_string();
    assert!(
        error.contains("ERR_ALREADY_CONVERTED") || error.contains("ERR_CONVERT_PENDING"),
        "unexpected error: {error}"
    );
    Ok(())
}

#[tokio::test]
async fn concurrent_convert_in_same_block_rejects_one() -> anyhow::Result<()> {
    let (worker, contract, _factory, owner, group_id) = setup().await?;

    // Submit both transactions before either is finalized. The contract state is
    // serialized per account, so the second call sees the first's pending flag.
    let first = owner
        .call(contract.id(), "convert_to_dao")
        .args_json(json!({
            "group_id": group_id,
            "dao_name": "race",
            "purpose": "",
        }))
        .deposit(NearToken::from_near(5))
        .max_gas()
        .transact();
    let second = owner
        .call(contract.id(), "convert_to_dao")
        .args_json(json!({
            "group_id": group_id,
            "dao_name": "race",
            "purpose": "",
        }))
        .deposit(NearToken::from_near(5))
        .max_gas()
        .transact();

    let (first, second) = tokio::join!(first, second);
    let results = [first?, second?];
    let failures = results
        .iter()
        .filter(|outcome| outcome.is_failure())
        .count();
    let successes = results
        .iter()
        .filter(|outcome| outcome.is_success())
        .count();
    assert_eq!(failures, 1, "one concurrent convert must be rejected");
    assert_eq!(successes, 1, "one concurrent convert must succeed");

    let error = results
        .iter()
        .find(|outcome| outcome.is_failure())
        .cloned()
        .expect("failure present")
        .into_result()
        .expect_err("failure")
        .to_string();
    assert!(
        error.contains("ERR_CONVERT_PENDING") || error.contains("ERR_ALREADY_CONVERTED"),
        "race must be rejected by GroupVault state, got: {error}"
    );

    let _ = worker;
    Ok(())
}

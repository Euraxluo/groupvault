mod common;

use near_workspaces::types::NearToken;
use serde_json::json;

#[tokio::test]
async fn get_groups_is_ascending_and_bounded() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let contract = common::deploy(&worker).await;
    let owner = worker.dev_create_account().await?;

    for index in 0..3 {
        let outcome = owner
            .call(contract.id(), "create_group")
            .args_json(json!({
                "name": format!("Group {index}"),
                "description": "",
                "join_fee": "1000000",
                "join_ft": "ft.testnet",
                "initial_members": [],
            }))
            .deposit(NearToken::from_millinear(500))
            .max_gas()
            .transact()
            .await?;
        assert_eq!(outcome.json::<u64>()?, index);
    }

    let page: serde_json::Value = contract
        .view("get_groups")
        .args_json(json!({ "from_index": 0, "limit": 2 }))
        .await?
        .json()?;

    let ids: Vec<u64> = page
        .as_array()
        .expect("group page array")
        .iter()
        .map(|group| group["id"].as_u64().expect("id"))
        .collect();
    assert_eq!(ids, vec![0, 1]);

    let tail: serde_json::Value = contract
        .view("get_groups")
        .args_json(json!({ "from_index": 1, "limit": 2 }))
        .await?
        .json()?;
    let tail_ids: Vec<u64> = tail
        .as_array()
        .expect("group page array")
        .iter()
        .map(|group| group["id"].as_u64().expect("id"))
        .collect();
    assert_eq!(tail_ids, vec![1, 2]);

    let beyond: serde_json::Value = contract
        .view("get_groups")
        .args_json(json!({ "from_index": 99, "limit": 50 }))
        .await?
        .json()?;
    assert_eq!(beyond.as_array().expect("array").len(), 0);

    let too_large = contract
        .view("get_groups")
        .args_json(json!({ "from_index": 0, "limit": 51 }))
        .await;
    assert!(too_large.is_err());

    let zero = contract
        .view("get_groups")
        .args_json(json!({ "from_index": 0, "limit": 0 }))
        .await;
    assert!(zero.is_err());

    let members: Vec<String> = contract
        .view("get_members")
        .args_json(json!({ "group_id": 0 }))
        .await?
        .json()?;
    assert_eq!(members, vec![owner.id().to_string()]);

    Ok(())
}

#[tokio::test]
async fn join_fee_balance_starts_at_zero() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let contract = common::deploy(&worker).await;
    let group_id = common::create_group(&contract, &worker.root_account()?, "Fees", vec![]).await;

    let balance: String = contract
        .view("get_join_fee_balance")
        .args_json(json!({ "group_id": group_id }))
        .await?
        .json()?;
    assert_eq!(balance, "0");
    Ok(())
}

mod common;

use near_sdk::json_types::U128;
use near_workspaces::types::NearToken;
use serde_json::{json, Value};

fn message_events(logs: &[&str]) -> Vec<Value> {
    logs.iter()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter(|value| value["standard"] == "groupvault" && value["event"] == "message")
        .collect()
}

#[tokio::test]
async fn member_message_emits_exact_public_log_schema() -> anyhow::Result<()> {
    let fixture = common::paid_join_fixture(1_000_000, 5_000_000).await?;
    common::join_msg(&fixture, 1_000_000).await?.into_result()?;

    let outcome = fixture
        .member
        .call(fixture.contract.id(), "send_message")
        .args_json(json!({ "group_id": fixture.group_id, "text": "  hello NEAR  " }))
        .max_gas()
        .transact()
        .await?;
    let result = outcome.into_result()?;

    let events = message_events(&result.logs());
    assert_eq!(events.len(), 1, "exactly one canonical message log");
    let event = &events[0];
    assert_eq!(event["version"], "0.1.0");
    assert_eq!(event["data"]["group_id"], fixture.group_id);
    assert_eq!(event["data"]["sender"], fixture.member.id().as_str());
    assert_eq!(
        event["data"]["text"], "  hello NEAR  ",
        "accepted text must be preserved byte for byte"
    );
    assert!(
        event["data"]["ts"].as_str().unwrap().parse::<u64>().is_ok(),
        "ts must be a decimal string"
    );

    // Message logs are not stored on chain.
    let state = fixture.contract.view_state().await?;
    let state_bytes = format!("{state:?}");
    assert!(!state_bytes.contains("hello NEAR"));
    Ok(())
}

#[tokio::test]
async fn owner_can_send_message_as_member() -> anyhow::Result<()> {
    let fixture = common::paid_join_fixture(1_000_000, 5_000_000).await?;
    let outcome = fixture
        .owner
        .call(fixture.contract.id(), "send_message")
        .args_json(json!({ "group_id": fixture.group_id, "text": "owner here" }))
        .max_gas()
        .transact()
        .await?;
    let events = message_events(&outcome.into_result()?.logs());
    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["data"]["sender"], fixture.owner.id().as_str());
    Ok(())
}

#[tokio::test]
async fn non_member_message_is_rejected() -> anyhow::Result<()> {
    let fixture = common::paid_join_fixture(1_000_000, 5_000_000).await?;
    let outcome = fixture
        .member
        .call(fixture.contract.id(), "send_message")
        .args_json(json!({ "group_id": fixture.group_id, "text": "intruder" }))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_failure());
    assert!(outcome
        .into_result()
        .expect_err("non member cannot chat")
        .to_string()
        .contains("ERR_NOT_MEMBER"));
    Ok(())
}

#[tokio::test]
async fn empty_message_is_rejected() -> anyhow::Result<()> {
    let fixture = common::paid_join_fixture(1_000_000, 5_000_000).await?;
    let outcome = fixture
        .owner
        .call(fixture.contract.id(), "send_message")
        .args_json(json!({ "group_id": fixture.group_id, "text": "   " }))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_failure());
    assert!(outcome
        .into_result()
        .expect_err("blank message cannot be sent")
        .to_string()
        .contains("ERR_EMPTY_MESSAGE"));
    Ok(())
}

#[tokio::test]
async fn message_at_byte_limit_is_accepted_and_over_limit_rejected() -> anyhow::Result<()> {
    let fixture = common::paid_join_fixture(1_000_000, 5_000_000).await?;
    let accepted = "a".repeat(4096);
    let outcome = fixture
        .owner
        .call(fixture.contract.id(), "send_message")
        .args_json(json!({ "group_id": fixture.group_id, "text": accepted }))
        .max_gas()
        .transact()
        .await?;
    outcome.into_result()?;

    let rejected = "a".repeat(4097);
    let outcome = fixture
        .owner
        .call(fixture.contract.id(), "send_message")
        .args_json(json!({ "group_id": fixture.group_id, "text": rejected }))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_failure());
    assert!(outcome
        .into_result()
        .expect_err("over limit message must fail")
        .to_string()
        .contains("ERR_MESSAGE_TOO_LONG"));
    let _ = U128(0);
    let _ = NearToken::from_yoctonear(0);
    Ok(())
}

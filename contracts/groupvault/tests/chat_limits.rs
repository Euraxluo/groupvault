mod common;

use serde_json::Value;

fn message_count(logs: &[&str]) -> usize {
    logs.iter()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter(|value| value["standard"] == "groupvault" && value["event"] == "message")
        .count()
}

#[tokio::test]
async fn multibyte_text_boundary_uses_utf8_bytes() -> anyhow::Result<()> {
    let fixture = common::paid_join_fixture(1_000_000, 5_000_000).await?;

    // 2048 * 2 bytes = 4096 accepted
    let accepted = "é".repeat(2048);
    let outcome = fixture
        .owner
        .call(fixture.contract.id(), "send_message")
        .args_json(serde_json::json!({ "group_id": fixture.group_id, "text": accepted }))
        .max_gas()
        .transact()
        .await?;
    assert_eq!(message_count(&outcome.into_result()?.logs()), 1);

    // 2049 * 2 bytes = 4098 rejected
    let rejected = "é".repeat(2049);
    let outcome = fixture
        .owner
        .call(fixture.contract.id(), "send_message")
        .args_json(serde_json::json!({ "group_id": fixture.group_id, "text": rejected }))
        .max_gas()
        .transact()
        .await?;
    assert!(outcome.is_failure());
    Ok(())
}

#[tokio::test]
async fn one_message_emits_one_event_only() -> anyhow::Result<()> {
    let fixture = common::paid_join_fixture(1_000_000, 5_000_000).await?;
    let outcome = fixture
        .owner
        .call(fixture.contract.id(), "send_message")
        .args_json(serde_json::json!({ "group_id": fixture.group_id, "text": "only once" }))
        .max_gas()
        .transact()
        .await?;
    let result = outcome.into_result()?;
    let logs = result.logs();
    assert_eq!(message_count(&logs), 1);
    Ok(())
}

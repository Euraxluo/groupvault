use near_sdk::env;
use serde_json::json;

pub const STANDARD: &str = "groupvault";
pub const VERSION: &str = "0.1.0";

fn emit(event: &str, data: serde_json::Value) {
    let payload = json!({
        "standard": STANDARD,
        "version": VERSION,
        "event": event,
        "data": data,
    });
    env::log_str(&payload.to_string());
}

pub fn group_created(group_id: u64, name: &str, join_fee: u128) {
    emit(
        "group_created",
        json!({
            "group_id": group_id,
            "name": name,
            "join_fee": join_fee.to_string(),
        }),
    );
}

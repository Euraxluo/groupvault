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

pub fn member_joined(group_id: u64, member: &near_sdk::AccountId, paid: u128) {
    emit(
        "member_joined",
        json!({
            "group_id": group_id,
            "member": member,
            "paid": paid.to_string(),
        }),
    );
}

pub fn join_fees_withdrawn(group_id: u64, owner: &near_sdk::AccountId, amount: u128) {
    emit(
        "join_fees_withdrawn",
        json!({
            "group_id": group_id,
            "owner": owner,
            "amount": amount.to_string(),
        }),
    );
}

pub fn join_fees_withdraw_failed(group_id: u64, amount: u128) {
    emit(
        "join_fees_withdraw_failed",
        json!({
            "group_id": group_id,
            "amount": amount.to_string(),
        }),
    );
}

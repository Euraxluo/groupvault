use near_sdk::json_types::U128;
use near_sdk::{ext_contract, AccountId, Gas, NearToken};
use serde::Deserialize;

pub const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(30);
pub const GAS_FOR_WITHDRAW_CALLBACK: Gas = Gas::from_tgas(20);
pub const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);

#[derive(Deserialize)]
pub struct JoinMessage {
    pub action: String,
    pub group_id: u64,
}

impl JoinMessage {
    /// Malformed input is a refund, never a panic: NEP-141 must be able to
    /// return the full unused amount to the sender.
    pub fn parse(msg: &str) -> Option<Self> {
        let parsed: JoinMessage = serde_json::from_str(msg).ok()?;
        if parsed.action != "join" {
            return None;
        }
        Some(parsed)
    }
}

#[ext_contract(ext_ft)]
pub trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

#[cfg(test)]
mod tests {
    use super::JoinMessage;

    #[test]
    fn parse_accepts_join_message() {
        let parsed = JoinMessage::parse(r#"{"action":"join","group_id":7}"#).unwrap();
        assert_eq!(parsed.action, "join");
        assert_eq!(parsed.group_id, 7);
    }

    #[test]
    fn parse_rejects_unknown_action_and_bad_json() {
        assert!(JoinMessage::parse(r#"{"action":"leave","group_id":7}"#).is_none());
        assert!(JoinMessage::parse("not-json").is_none());
        assert!(JoinMessage::parse(r#"{"action":"join"}"#).is_none());
    }
}

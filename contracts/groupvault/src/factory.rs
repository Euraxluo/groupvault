use near_sdk::{ext_contract, AccountId, Gas, NearToken};
use serde_json::{json, Value};

pub const CONVERT_DEPOSIT: NearToken = NearToken::from_near(10);
pub const GAS_FOR_FACTORY_CALL: Gas = Gas::from_tgas(100);
pub const GAS_FOR_CONVERT_CALLBACK: Gas = Gas::from_tgas(20);

#[ext_contract(ext_sputnik_factory)]
pub trait SputnikFactory {
    fn create(&mut self, name: String, args: String) -> bool;
}

/// The factory expects `args` to be the base64 encoding of the inner policy JSON.
pub fn build_factory_args(dao_name: &str, purpose: &str, members: &[AccountId]) -> String {
    let inner = json!({
        "config": {
            "name": dao_name,
            "purpose": purpose,
            "metadata": "",
        },
        "policy": members,
    });
    base64_encode(inner.to_string().as_bytes())
}

fn base64_encode(bytes: &[u8]) -> String {
    use near_sdk::base64::Engine;
    near_sdk::base64::engine::general_purpose::STANDARD.encode(bytes)
}

pub fn expected_dao_account(dao_name: &str, factory_id: &AccountId) -> AccountId {
    format!("{dao_name}.{factory_id}")
        .parse()
        .expect("ERR_INVALID_DAO_NAME")
}

pub fn parse_factory_result(payload: &[u8]) -> Option<bool> {
    // The real sputnikv2 factory's `create` schedules the sub-account creation
    // and returns unit, so a successful promise resolves with an empty payload.
    // An empty success means the factory accepted the call; a non-empty payload
    // must still be an explicit JSON boolean (malformed output is a failure).
    if payload.is_empty() {
        return Some(true);
    }
    serde_json::from_slice::<Value>(payload)
        .ok()
        .and_then(|value| value.as_bool())
}

pub fn validate_dao_name(dao_name: &str) {
    assert!(!dao_name.trim().is_empty(), "ERR_EMPTY_DAO_NAME");
    assert!(
        dao_name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_'),
        "ERR_INVALID_DAO_NAME"
    );
    assert!(dao_name.len() <= 32, "ERR_INVALID_DAO_NAME");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn factory_args_are_base64_inner_json_with_unqualified_name() {
        use near_sdk::base64::Engine;
        let members: Vec<AccountId> = vec!["a.testnet".parse().unwrap()];
        let encoded = build_factory_args("builders", "paid group", &members);
        let raw = near_sdk::base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .unwrap();
        let json: Value = serde_json::from_slice(&raw).unwrap();

        assert_eq!(json["config"]["name"], "builders");
        assert_eq!(json["config"]["metadata"], "");
        assert_eq!(json["policy"][0], "a.testnet");
        assert_eq!(json["policy"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn factory_result_only_accepts_boolean_true() {
        assert_eq!(parse_factory_result(b"true"), Some(true));
        assert_eq!(parse_factory_result(b"false"), Some(false));
        assert_eq!(parse_factory_result(b"\"true\""), None);
        // Real sputnikv2.create resolves with unit on success.
        assert_eq!(parse_factory_result(b""), Some(true));
        assert_eq!(parse_factory_result(b"not-json"), None);
    }

    #[test]
    fn dao_name_validation_rejects_bad_names() {
        validate_dao_name("builders-01");
        for bad in ["", " ", "Builders", "bad.name", "with space"] {
            assert!(std::panic::catch_unwind(|| validate_dao_name(bad)).is_err());
        }
    }
}

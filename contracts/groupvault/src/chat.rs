use near_sdk::env;

use crate::events;
use crate::state::Group;

pub const MAX_MESSAGE_BYTES: usize = 4096;

pub fn validate_text(text: &str) {
    assert!(!text.trim().is_empty(), "ERR_EMPTY_MESSAGE");
    assert!(text.len() <= MAX_MESSAGE_BYTES, "ERR_MESSAGE_TOO_LONG");
}

pub fn require_member(group: &Group, account_id: &near_sdk::AccountId) {
    assert!(group.contains(account_id), "ERR_NOT_MEMBER");
}

pub fn emit_message(group: &Group, sender: &near_sdk::AccountId, text: &str) {
    validate_text(text);
    require_member(group, sender);
    events::message(group.id, sender, text, env::block_timestamp());
}

#[cfg(test)]
mod tests {
    use super::validate_text;

    #[test]
    fn rejects_empty_or_whitespace_text() {
        assert!(std::panic::catch_unwind(|| validate_text("")).is_err());
        assert!(std::panic::catch_unwind(|| validate_text("   \n\t ")).is_err());
    }

    #[test]
    fn preserves_surrounding_whitespace() {
        validate_text("  hello  ");
    }

    #[test]
    fn limit_is_exact_utf8_bytes() {
        validate_text(&"a".repeat(4096));
        assert!(std::panic::catch_unwind(|| validate_text(&"a".repeat(4097))).is_err());
    }

    #[test]
    fn limit_counts_bytes_not_characters() {
        // 2048 two-byte chars = 4096 bytes (accepted), 2049 = 4098 bytes.
        validate_text(&"é".repeat(2048));
        assert!(std::panic::catch_unwind(|| validate_text(&"é".repeat(2049))).is_err());
    }
}

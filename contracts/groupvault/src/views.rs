use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

pub const MAX_MEMBERS: usize = 50;
pub const MAX_GROUP_PAGE: u64 = 50;

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GroupView {
    pub id: u64,
    pub owner: AccountId,
    pub name: String,
    pub description: String,
    pub join_fee: U128,
    pub join_ft: AccountId,
    pub member_count: u32,
    pub dao_id: Option<AccountId>,
    pub convert_pending: bool,
    pub created_at: u64,
}

impl GroupView {
    pub fn assert_valid_limit(limit: u64) {
        assert!(limit > 0 && limit <= MAX_GROUP_PAGE, "ERR_INVALID_LIMIT");
    }
}

use near_sdk::{near, AccountId, BorshStorageKey};

use crate::views::GroupView;

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
pub enum StorageKey {
    Groups,
    GroupIds,
}

#[near(serializers = [borsh])]
pub struct Group {
    pub id: u64,
    pub owner: AccountId,
    pub name: String,
    pub description: String,
    pub join_fee: u128,
    pub join_ft: AccountId,
    pub members: Vec<AccountId>,
    pub dao_id: Option<AccountId>,
    pub convert_pending: bool,
    pub created_at: u64,
    pub join_fee_balance: u128,
}

impl Group {
    pub fn view(&self) -> GroupView {
        GroupView {
            id: self.id,
            owner: self.owner.clone(),
            name: self.name.clone(),
            description: self.description.clone(),
            join_fee: self.join_fee.into(),
            join_ft: self.join_ft.clone(),
            member_count: self.members.len() as u32,
            dao_id: self.dao_id.clone(),
            convert_pending: self.convert_pending,
            created_at: self.created_at,
        }
    }

    pub fn contains(&self, account_id: &AccountId) -> bool {
        self.members.iter().any(|member| member == account_id)
    }
}

/// Owner first, de-duplicated, preserving the caller-supplied order afterwards.
pub fn normalize_members(owner: AccountId, initial_members: Vec<AccountId>) -> Vec<AccountId> {
    let mut members = Vec::with_capacity(initial_members.len() + 1);
    members.push(owner);

    for account_id in initial_members {
        if !members.iter().any(|member| member == &account_id) {
            members.push(account_id);
        }
    }

    members
}

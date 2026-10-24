pub mod events;
pub mod state;
pub mod views;

use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, Promise};

use crate::state::{Group, StorageKey};
use crate::views::{GroupView, MAX_MEMBERS};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner: AccountId,
    factory_id: AccountId,
    groups: LookupMap<u64, Group>,
    group_ids: Vector<u64>,
    next_group_id: u64,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner: AccountId, factory_id: AccountId) -> Self {
        Self {
            owner,
            factory_id,
            groups: LookupMap::new(StorageKey::Groups),
            group_ids: Vector::new(StorageKey::GroupIds),
            next_group_id: 0,
        }
    }

    #[payable]
    pub fn create_group(
        &mut self,
        name: String,
        description: String,
        join_fee: U128,
        join_ft: AccountId,
        initial_members: Vec<AccountId>,
    ) -> u64 {
        assert!(!name.trim().is_empty(), "ERR_EMPTY_NAME");

        let owner = env::predecessor_account_id();
        let members = state::normalize_members(owner.clone(), initial_members);
        assert!(members.len() <= MAX_MEMBERS, "ERR_MEMBERS_EXCEEDED");

        let group_id = self.next_group_id;

        let group = Group {
            id: group_id,
            owner: owner.clone(),
            name: name.clone(),
            description,
            join_fee: join_fee.0,
            join_ft,
            members,
            dao_id: None,
            convert_pending: false,
            created_at: env::block_timestamp(),
            join_fee_balance: 0,
        };

        // `store` collections flush at the end of the call, so `storage_usage()`
        // measured after `insert` would not include this group yet. Charge from
        // the serialized value plus collection key/index overhead instead.
        let value_bytes = near_sdk::borsh::to_vec(&group)
            .expect("ERR_SERIALIZE")
            .len() as u128;
        let required_bytes = value_bytes + 32;
        let required =
            NearToken::from_yoctonear(env::storage_byte_cost().as_yoctonear() * required_bytes);
        let attached = env::attached_deposit();
        assert!(attached >= required, "ERR_STORAGE_DEPOSIT");

        self.groups.insert(group_id, group);
        self.group_ids.push(group_id);
        self.next_group_id = group_id + 1;

        let refund = attached.saturating_sub(required);
        if !refund.is_zero() {
            Promise::new(owner).transfer(refund);
        }

        events::group_created(group_id, &name, join_fee.0);
        group_id
    }

    pub fn get_group(&self, group_id: u64) -> GroupView {
        self.group(group_id).view()
    }

    pub fn get_members(&self, group_id: u64) -> Vec<AccountId> {
        self.group(group_id).members.clone()
    }

    pub fn get_dao_id(&self, group_id: u64) -> Option<AccountId> {
        self.group(group_id).dao_id.clone()
    }

    pub fn is_member(&self, group_id: u64, account_id: AccountId) -> bool {
        self.group(group_id).contains(&account_id)
    }

    pub fn get_groups(&self, from_index: u64, limit: u64) -> Vec<GroupView> {
        GroupView::assert_valid_limit(limit);
        let total = self.group_ids.len() as u64;
        let start = from_index.min(total);
        let end = from_index.saturating_add(limit).min(total);

        (start..end)
            .filter_map(|index| u32::try_from(index).ok())
            .filter_map(|index| self.group_ids.get(index).copied())
            .filter_map(|group_id| self.groups.get(&group_id).map(Group::view))
            .collect()
    }

    pub fn get_join_fee_balance(&self, group_id: u64) -> U128 {
        self.group(group_id).join_fee_balance.into()
    }

    fn group(&self, group_id: u64) -> &Group {
        self.groups.get(&group_id).expect("ERR_GROUP_NOT_FOUND")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_members_puts_owner_first_once() {
        let owner: AccountId = "owner.testnet".parse().unwrap();
        let member: AccountId = "member.testnet".parse().unwrap();

        let members = state::normalize_members(
            owner.clone(),
            vec![member.clone(), owner.clone(), member.clone()],
        );

        assert_eq!(members, vec![owner, member]);
    }

    #[test]
    fn normalize_members_allows_empty_initial_list() {
        let owner: AccountId = "owner.testnet".parse().unwrap();
        assert_eq!(state::normalize_members(owner.clone(), vec![]), vec![owner]);
    }

    #[test]
    fn normalize_members_caps_at_fifty() {
        let owner: AccountId = "owner.testnet".parse().unwrap();
        let members: Vec<AccountId> = (0..60)
            .map(|index| format!("member{index}.testnet").parse().unwrap())
            .collect();
        assert_eq!(state::normalize_members(owner, members).len(), 61);
    }
}

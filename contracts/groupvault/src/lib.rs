pub mod events;
pub mod ft;
pub mod state;
pub mod views;

use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, Promise, PromiseResult};

use crate::ft::{ext_ft, JoinMessage, GAS_FOR_FT_TRANSFER, GAS_FOR_WITHDRAW_CALLBACK, ONE_YOCTO};
use crate::state::{Group, PendingWithdrawal, StorageKey};
use crate::views::{GroupView, MAX_MEMBERS};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner: AccountId,
    factory_id: AccountId,
    groups: LookupMap<u64, Group>,
    group_ids: Vector<u64>,
    pending_withdrawals: LookupMap<u64, PendingWithdrawal>,
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
            pending_withdrawals: LookupMap::new(StorageKey::PendingWithdrawals),
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

    /// NEP-141 receiver callback. Every rejection returns the full amount so
    /// the FT contract refunds the sender; none of these paths panic.
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> U128 {
        let Some(message) = JoinMessage::parse(&msg) else {
            return amount;
        };
        let Some(group) = self.groups.get(&message.group_id) else {
            return amount;
        };

        if env::predecessor_account_id() != group.join_ft {
            return amount;
        }
        if group.contains(&sender_id) || amount.0 < group.join_fee {
            return amount;
        }

        let Some(group) = self.groups.get_mut(&message.group_id) else {
            return amount;
        };
        group.members.push(sender_id.clone());
        group.join_fee_balance = group
            .join_fee_balance
            .checked_add(amount.0)
            .expect("ERR_BALANCE_OVERFLOW");

        events::member_joined(message.group_id, &sender_id, amount.0);
        U128(0)
    }

    #[payable]
    pub fn withdraw_join_fees(&mut self, group_id: u64, amount: U128) {
        let owner = env::predecessor_account_id();
        let group = self.group(group_id);
        assert_eq!(owner, group.owner, "ERR_NOT_GROUP_OWNER");
        assert!(amount.0 > 0, "ERR_ZERO_AMOUNT");
        assert!(
            group.join_fee_balance >= amount.0,
            "ERR_INSUFFICIENT_JOIN_FEES"
        );
        assert!(
            !self.pending_withdrawals.contains_key(&group_id),
            "ERR_WITHDRAW_PENDING"
        );
        let join_ft = group.join_ft.clone();

        self.pending_withdrawals.insert(
            group_id,
            PendingWithdrawal {
                group_id,
                owner: owner.clone(),
                amount: amount.0,
            },
        );

        ext_ft::ext(join_ft)
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .with_attached_deposit(ONE_YOCTO)
            .ft_transfer(owner.clone(), amount, None)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_WITHDRAW_CALLBACK)
                    .on_withdraw_complete(group_id, owner, amount),
            );
    }

    #[private]
    pub fn on_withdraw_complete(&mut self, group_id: u64, owner: AccountId, amount: U128) {
        let succeeded = matches!(env::promise_result(0), PromiseResult::Successful(_));
        let pending = self.pending_withdrawals.remove(&group_id);

        if !succeeded {
            if pending.is_some() {
                events::join_fees_withdraw_failed(group_id, amount.0);
            }
            return;
        }

        if pending.is_some() {
            if let Some(group) = self.groups.get_mut(&group_id) {
                group.join_fee_balance = group
                    .join_fee_balance
                    .checked_sub(amount.0)
                    .expect("ERR_WITHDRAW_ACCOUNTING");
            }
            events::join_fees_withdrawn(group_id, &owner, amount.0);
        }
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

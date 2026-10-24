use near_contract_standards::fungible_token::core::FungibleTokenCore;
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider,
};
use near_contract_standards::fungible_token::resolver::FungibleTokenResolver;
use near_contract_standards::fungible_token::FungibleToken;
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::json_types::U128;
use near_sdk::{assert_one_yocto, env, near, AccountId, NearToken, PanicOnDefault, PromiseOrValue};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct TestToken {
    token: FungibleToken,
    owner: AccountId,
    metadata: FungibleTokenMetadata,
    fail_transfers: bool,
}

#[near]
impl TestToken {
    #[init]
    pub fn new(owner: AccountId, name: String, symbol: String, decimals: u8) -> Self {
        Self {
            token: FungibleToken::new(b"t".to_vec()),
            owner,
            fail_transfers: false,
            metadata: FungibleTokenMetadata {
                spec: "ft-1.0.0".to_string(),
                name,
                symbol,
                icon: None,
                reference: None,
                reference_hash: None,
                decimals,
            },
        }
    }

    /// Demo-only mint. The deployer owns the fixture; this is not a real asset.
    #[payable]
    pub fn mint(&mut self, account_id: AccountId, amount: U128) {
        assert_one_yocto();
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "ERR_NOT_TOKEN_OWNER"
        );
        assert!(amount.0 > 0, "ERR_ZERO_AMOUNT");
        self.token.internal_deposit(&account_id, amount.0);
    }

    pub fn owner(&self) -> AccountId {
        self.owner.clone()
    }

    /// Test-only fault injection so GroupVault's withdrawal callback is
    /// exercised against a genuinely failed FT transfer.
    pub fn set_fail_transfers(&mut self, fail: bool) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "ERR_NOT_TOKEN_OWNER"
        );
        self.fail_transfers = fail;
    }
}

#[near]
impl FungibleTokenCore for TestToken {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        assert!(!self.fail_transfers, "ERR_FT_TRANSFER_DISABLED");
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        assert!(!self.fail_transfers, "ERR_FT_TRANSFER_DISABLED");
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for TestToken {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let (used, _burned) =
            self.token
                .internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        used.into()
    }
}

#[near]
impl StorageManagement for TestToken {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.storage_unregister(force)
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for TestToken {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.clone()
    }
}

use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault};
#[derive(Clone)]
#[near(serializers = [borsh, json])]
pub enum Mode {
    Succeed,
    ReturnFalse,
    Fail,
    ReturnMalformed,
}

#[derive(Clone)]
#[near(serializers = [borsh, json])]
pub struct LastCall {
    pub name: String,
    pub args: String,
    pub deposit: String,
    pub predecessor: AccountId,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct TestFactory {
    mode: Mode,
    last_call: Option<LastCall>,
}

#[near]
impl TestFactory {
    #[init]
    pub fn new(mode: Mode) -> Self {
        Self {
            mode,
            last_call: None,
        }
    }

    #[payable]
    pub fn create(&mut self, name: String, args: String) -> bool {
        self.last_call = Some(LastCall {
            name,
            args,
            deposit: env::attached_deposit().as_yoctonear().to_string(),
            predecessor: env::predecessor_account_id(),
        });

        match self.mode {
            Mode::Succeed => true,
            Mode::ReturnFalse => false,
            Mode::ReturnMalformed => {
                env::value_return(b"\"not-a-boolean\"");
                false
            }
            Mode::Fail => env::panic_str("ERR_FACTORY_FAILED"),
        }
    }

    pub fn set_mode(&mut self, mode: Mode) {
        self.mode = mode;
    }

    pub fn last_call(&self) -> Option<LastCall> {
        self.last_call.clone()
    }

    pub fn min_deposit(&self) -> NearToken {
        NearToken::from_near(10)
    }
}

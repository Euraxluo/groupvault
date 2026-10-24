#![allow(dead_code)]

use near_sdk::json_types::U128;
use near_workspaces::network::Sandbox;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, Contract, Worker};
use serde_json::json;
use std::path::Path;
use std::process::Command;

pub const DEFAULT_WASM: &str = "../target/wasm32-unknown-unknown/release/groupvault_contract.wasm";
pub const TOKEN_WASM: &str = "../target/wasm32-unknown-unknown/release/groupvault_test_token.wasm";

pub fn wasm_bytes() -> Vec<u8> {
    read_or_build(std::env::var("GROUPVAULT_WASM").unwrap_or_else(|_| DEFAULT_WASM.to_string()))
}

pub fn token_wasm_bytes() -> Vec<u8> {
    read_or_build(std::env::var("GROUPVAULT_TOKEN_WASM").unwrap_or_else(|_| TOKEN_WASM.to_string()))
}

fn read_or_build(path: String) -> Vec<u8> {
    if !Path::new(&path).exists() {
        let status = Command::new("cargo")
            .args([
                "build",
                "--manifest-path",
                "../Cargo.toml",
                "--package",
                "groupvault-contract",
                "--package",
                "groupvault-test-token",
                "--target",
                "wasm32-unknown-unknown",
                "--release",
            ])
            .status()
            .expect("run cargo build for the contract wasm");
        assert!(status.success(), "cargo build for the contract wasm failed");
    }
    std::fs::read(&path)
        .unwrap_or_else(|error| panic!("failed to read GroupVault wasm at {path}: {error}"))
}

pub async fn deploy_token(worker: &Worker<Sandbox>) -> Contract {
    let contract = worker
        .dev_deploy(&token_wasm_bytes())
        .await
        .expect("deploy test token");
    contract
        .call("new")
        .args_json(json!({
            "owner": worker.root_account().expect("root").id(),
            "name": "GroupVault Join Token",
            "symbol": "GVJOIN",
            "decimals": 6,
        }))
        .transact()
        .await
        .expect("init token")
        .into_result()
        .expect("init token result");
    contract
}

pub async fn mint(token: &Contract, signer: &Account, account: &Account, amount: u128) {
    signer
        .call(token.id(), "mint")
        .args_json(json!({ "account_id": account.id(), "amount": U128(amount) }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await
        .expect("mint transaction")
        .into_result()
        .expect("mint result");
}

pub async fn register(token: &Contract, signer: &Account, account_id: &near_workspaces::AccountId) {
    signer
        .call(token.id(), "storage_deposit")
        .args_json(json!({
            "account_id": account_id,
            "registration_only": true,
        }))
        .deposit(NearToken::from_millinear(50))
        .max_gas()
        .transact()
        .await
        .expect("storage_deposit transaction")
        .into_result()
        .expect("storage_deposit result");
}

pub async fn deploy(worker: &Worker<Sandbox>) -> Contract {
    let contract = worker
        .dev_deploy(&wasm_bytes())
        .await
        .expect("deploy GroupVault");
    contract
        .call("new")
        .args_json(json!({
            "owner": worker.root_account().expect("root").id(),
            "factory_id": "sputnikv2.testnet",
        }))
        .transact()
        .await
        .expect("init transaction")
        .into_result()
        .expect("init result");
    contract
}

pub async fn create_group(
    contract: &Contract,
    signer: &Account,
    name: &str,
    initial_members: Vec<&Account>,
) -> u64 {
    let members: Vec<&str> = initial_members
        .iter()
        .map(|account| account.id().as_str())
        .collect();
    signer
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": name,
            "description": "paid builders",
            "join_fee": "1000000",
            "join_ft": "ft.testnet",
            "initial_members": members,
        }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await
        .expect("create_group transaction")
        .json::<u64>()
        .expect("group id")
}

pub struct Fixture {
    pub contract: Contract,
    pub token: Contract,
    pub root: Account,
    pub owner: Account,
    pub member: Account,
    pub group_id: u64,
    pub join_fee: u128,
}

pub async fn paid_join_fixture(join_fee: u128, minted: u128) -> anyhow::Result<Fixture> {
    let worker = near_workspaces::sandbox().await?;
    let contract = deploy(&worker).await;
    let token = deploy_token(&worker).await;
    let owner = worker.dev_create_account().await?;
    let member = worker.dev_create_account().await?;
    let root = worker.root_account()?;
    register(&token, &root, owner.id()).await;
    register(&token, &root, member.id()).await;
    register(&token, &root, contract.id()).await;

    let outcome = owner
        .call(contract.id(), "create_group")
        .args_json(json!({
            "name": "Paid Builders",
            "description": "join by FT",
            "join_fee": U128(join_fee),
            "join_ft": token.id(),
            "initial_members": [],
        }))
        .deposit(NearToken::from_millinear(500))
        .max_gas()
        .transact()
        .await?;
    let group_id: u64 = outcome.json()?;

    mint(&token, &root, &member, minted).await;
    mint(&token, &root, &owner, minted).await;

    Ok(Fixture {
        contract,
        token,
        root,
        owner,
        member,
        group_id,
        join_fee,
    })
}

pub async fn ft_balance(token: &Contract, account: &str) -> anyhow::Result<u128> {
    let balance: U128 = token
        .view("ft_balance_of")
        .args_json(json!({ "account_id": account }))
        .await?
        .json()?;
    Ok(balance.0)
}

pub async fn join_msg(
    fixture: &Fixture,
    amount: u128,
) -> anyhow::Result<near_workspaces::result::ExecutionFinalResult> {
    Ok(fixture
        .member
        .call(fixture.token.id(), "ft_transfer_call")
        .args_json(json!({
            "receiver_id": fixture.contract.id(),
            "amount": U128(amount),
            "memo": null,
            "msg": json!({ "action": "join", "group_id": fixture.group_id }).to_string(),
        }))
        .deposit(NearToken::from_yoctonear(1))
        .max_gas()
        .transact()
        .await?)
}

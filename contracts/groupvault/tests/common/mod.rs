#![allow(dead_code)]

use near_workspaces::network::Sandbox;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, Contract, Worker};
use serde_json::json;
use std::path::Path;
use std::process::Command;

pub const DEFAULT_WASM: &str = "../target/wasm32-unknown-unknown/release/groupvault_contract.wasm";

pub fn wasm_bytes() -> Vec<u8> {
    let path = std::env::var("GROUPVAULT_WASM").unwrap_or_else(|_| DEFAULT_WASM.to_string());
    if !Path::new(&path).exists() {
        let status = Command::new("cargo")
            .args([
                "build",
                "--manifest-path",
                "../Cargo.toml",
                "--package",
                "groupvault-contract",
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

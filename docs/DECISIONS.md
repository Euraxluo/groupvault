# GroupVault Decisions

Recorded: 2026-10-24 Asia/Shanghai
Scope: P0 Must path for the NEAR hackathon demo.

## Gate

**O1-O6 沿用推荐默认（approved 2026-10-24, recorded with the operator's
reviewed plan).** The reviewed plan recommends these defaults and the operator
prompt authorizes execution of `TASKS.md` P0 work. No question is silently
treated as approval: each decision below names its implementation consequence,
and any change requires a new written decision here before code changes.

| ID | Decision | Consequence in this repository |
| --- | --- | --- |
| O1 | approved: use NEP-141 `ft_on_transfer` (option A) | The only paid-join path is `ft_transfer_call`. GroupVault validates `predecessor == join_ft` and returns all unused base units on every rejection. |
| O2 | approved: prefill the current member snapshot at Convert | `convert_to_dao` snapshots at most 50 members into the Sputnik policy array. The demo uses a one-member A-only council. |
| O3 | approved: enable staking after Convert via `SetStakingContract` | GroupVault never sets staking. Staking is deployed by the deployer, then a council proposal points the DAO at it. |
| O4 | approved: members may be added after Convert without joining council | GroupVault membership and the DAO policy are separate. New members never gain council seats or voting weight automatically. |
| O5 | approved: log-only messages plus a light indexer | `send_message` emits one canonical JSON `env::log_str`; no on-chain buffer. The UI must state that chat is public and that indexing may lag. |
| O6 | approved: working directory and public name are `groupvault` | Code root is `/Users/echo/project/groupvault/`; no `chatme.near` binding. |

## Non-negotiable boundaries

- Convert is exactly one owner wallet signature to GroupVault, which calls
  Sputnik `factory.create`. `dao_id` is written only in the private callback
  after both the promise and the factory boolean are true.
- No FROST, DKG, VSS, threshold signing, key resharing, Walrus, SEAL, or E2E
  encrypted chat in the product path.
- No server signer, hosted seed, keystore API, or sponsored user action. The
  wallet selector is the only user signing boundary.
- Paid membership creates membership only. Voting weight comes only from
  staking the same join FT after the DAO and staking contract exist.
- Join fees remain GroupVault liabilities; Convert does not sweep them.
- Only NEAR testnet is deployed for the demo.

## Fixed interfaces

These are frozen for T003-T014; see `docs/CONTRACT-INTERFACES.md` for the
machine-readable argument and return shapes.

| Surface | Signature |
| --- | --- |
| Init | `new(owner: AccountId, factory_id: AccountId)` |
| Create | `#[payable] create_group(name, description, join_fee: U128, join_ft, initial_members) -> u64` |
| Views | `get_group`, `get_members`, `get_dao_id`, `is_member`, `get_groups(from_index, limit)`, `get_join_fee_balance` |
| Join | `ft_on_transfer(sender_id, amount, msg) -> U128` returning unused base units |
| Convert | `#[payable] convert_to_dao(group_id, dao_name, purpose)` |

## Access and limits

- Any signer may create a group, sending itself exactly once as owner.
- Initial members are capped at 50 including the owner.
- `get_groups` pages by ascending group ID and rejects `limit > 50`.
- Only the group owner may withdraw join fees or start Convert.
- Membership composition is frozen while `convert_pending` is true.

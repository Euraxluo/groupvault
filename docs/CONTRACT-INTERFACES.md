# GroupVault Contract Interfaces

This file is the cross-task contract between the Rust contract, the indexer, the
NEAR adapters and the copied Next.js UI. Amounts are NEP-141 base units encoded
as decimal strings through `U128`. Account IDs are NEAR account IDs.

## Initialization

```text
new(owner: AccountId, factory_id: AccountId)
```

Called once by the deployer. `owner` is the contract administrator, not a group
owner. Repeated initialization must fail.

## Group creation

```text
#[payable]
create_group(
  name: String,
  description: String,
  join_fee: U128,
  join_ft: AccountId,
  initial_members: Vec<AccountId>
) -> u64
```

- Caller is recorded as `owner` and becomes a member exactly once.
- `initial_members` may be empty; the owner is always added.
- At most 50 members after deduplication; exceeding the cap panics.
- Empty or whitespace-only `name` panics.
- IDs are assigned sequentially from zero; clients must use the returned ID and
  never assume zero.
- Creation performs no factory call and sets `dao_id = null`,
  `convert_pending = false`.

## Views

```text
get_group(group_id: u64) -> GroupView
get_members(group_id: u64) -> Vec<AccountId>
get_dao_id(group_id: u64) -> Option<AccountId>
is_member(group_id: u64, account_id: AccountId) -> bool
get_groups(from_index: u64, limit: u64) -> Vec<GroupView>
get_join_fee_balance(group_id: u64) -> U128
```

`GroupView`:

```json
{
  "id": 3,
  "owner": "alice.testnet",
  "name": "Builders",
  "description": "Paid builders group",
  "join_fee": "1000000",
  "join_ft": "ft.testnet",
  "member_count": 2,
  "dao_id": null,
  "convert_pending": false,
  "created_at": "1760000000000000000"
}
```

- `get_groups` sorts by ascending ID and returns at most `limit` items.
- `limit` must be 1-50; `limit = 0` or `limit > 50` panics.
- `get_join_fee_balance` is the tracked successful-receipt accounting, not the
  contract's entire NEAR balance.

## Paid join (NEP-141)

The user calls the FT:

```text
ft_transfer_call({
  "receiver_id": "<groupvault>",
  "amount": "<join_fee or more>",
  "msg": "{\"action\":\"join\",\"group_id\":3}"
}, 1 yoctoNEAR)
```

GroupVault implements:

```text
ft_on_transfer(sender_id: AccountId, amount: U128, msg: String) -> U128
```

- `predecessor` must equal the group's `join_ft`; otherwise return the full
  `amount`.
- `msg` must be a JSON object with `action = "join"` and a `group_id` number.
- Reject (return the full `amount`) on malformed JSON, wrong action, missing
  group, duplicate member, or `amount < join_fee`.
- On success add the sender once, credit `amount` to the group fee account, and
  return `"0"`.
- The callback must never add staking weight or create a DAO proposal.

## Withdraw join fees

```text
#[payable]
withdraw_join_fees(group_id: u64, amount: U128)
```

- Group owner only.
- Implemented as an FT transfer to the owner followed by a private callback.
- The accounting balance decreases only when the FT transfer succeeds.
- A failed withdrawal must leave both accounting and member state unchanged.

## Chat log

```text
send_message(group_id: u64, text: String)
```

- Members only.
- Emptiness is checked after trimming; accepted text is preserved byte for byte.
- UTF-8 payload is capped at 4096 bytes.
- Emits exactly one `env::log_str` JSON object:

```json
{
  "standard": "groupvault",
  "version": "0.1.0",
  "event": "message",
  "data": {
    "group_id": 3,
    "sender": "alice.testnet",
    "text": "hello",
    "ts": "1760000000000000000"
  }
}
```

- No message bytes are written to contract storage.

## Convert to DAO

```text
#[payable]
convert_to_dao(group_id: u64, dao_name: String, purpose: String)
```

- Group owner only; requires `dao_id == null` and `convert_pending == false`.
- Sets `convert_pending = true` before the cross-contract call.
- Snapshots at most 50 current members and passes them as the factory policy
  array.
- Calls `sputnikv2.testnet.create` with 10 NEAR for the P0 runbook:

```json
{
  "name": "builders",
  "args": "<base64 of inner JSON>"
}
```

Inner JSON:

```json
{
  "config": { "name": "builders", "purpose": "paid group", "metadata": "" },
  "policy": ["alice.testnet", "bob.testnet"]
}
```

- `config.name` is unqualified; the factory derives
  `{name}.sputnikv2.testnet`.
- Private callback requires a successful promise result and factory boolean
  `true`. Only then write `dao_id`, clear `convert_pending`, and emit
  `convert_done`.
- On a false result or failed promise, clear `convert_pending` and leave
  `dao_id = null`; emit `convert_failed`.
- Re-entrant or concurrent Convert while pending panics.
- Roster mutations are rejected while pending.
- Join fees are not transferred to the DAO.

## Error surface

Errors panic with stable prefixes so the UI and scripts can classify them:

```text
ERR_NOT_INITIALIZED
ERR_ALREADY_INITIALIZED
ERR_GROUP_NOT_FOUND
ERR_NOT_GROUP_OWNER
ERR_NOT_MEMBER
ERR_ALREADY_MEMBER
ERR_EMPTY_NAME
ERR_MEMBERS_EXCEEDED
ERR_EMPTY_MESSAGE
ERR_MESSAGE_TOO_LONG
ERR_CONVERT_PENDING
ERR_ALREADY_CONVERTED
ERR_CONVERT_DEPOSIT
ERR_INVALID_LIMIT
ERR_ROSTER_FROZEN
```

Refund paths in `ft_on_transfer` do not panic; they return the unused amount so
NEP-141 can refund the sender.

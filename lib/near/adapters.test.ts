import { describe, expect, it, vi } from "vitest"

import { GAS, ONE_YOCTO, getNearConfig } from "./config"
import { buildJoinMessage, joinGroup } from "./ft"
import { createGroupVaultClient } from "./groupvault"
import { getMessages } from "./indexer"
import { NearRpc } from "./rpc"
import {
  actProposalAction,
  addProposalAction,
  setStakingContractKind,
  tokenWeightPolicyUpdate,
  transferKind,
} from "./sputnik"
import { createStakingClient } from "./staking"

function fakeSelector() {
  const signAndSendTransaction = vi.fn().mockResolvedValue({
    transaction_outcome: { id: "tx-hash" },
    receipts_outcome: [{ id: "receipt-1" }],
  })
  return {
    signAndSendTransaction,
    selector: {
      store: { getState: () => ({ selectedWalletId: "my-near-wallet" }) },
      wallet: async () => ({ signAndSendTransaction }),
    },
  }
}

function fakeRpc() {
  return { view: vi.fn().mockResolvedValue(null) } as unknown as NearRpc
}

describe("NEAR config", () => {
  it("defaults to testnet public values and never requires a secret", () => {
    const config = getNearConfig()
    expect(config.network).toBe("testnet")
    expect(config.factoryId).toBe("sputnikv2.testnet")
    expect(config.indexerUrl).toMatch(/^http/)
  })
})

describe("GroupVault adapter", () => {
  it("builds wallet-delegated FunctionCall transactions with the expected contract and gas", async () => {
    const { selector, signAndSendTransaction } = fakeSelector()
    const client = createGroupVaultClient(selector as never, fakeRpc(), "gv.testnet")

    const receipt = await client.sendMessage("alice.testnet", 3, "hello")

    expect(receipt.transactionHash).toBe("tx-hash")
    expect(signAndSendTransaction).toHaveBeenCalledWith({
      signerId: "alice.testnet",
      receiverId: "gv.testnet",
      actions: [
        expect.objectContaining({
          functionCall: expect.objectContaining({
            methodName: "send_message",
            deposit: BigInt(0),
            gas: BigInt(GAS.chat),
          }),
        }),
      ],
    })
    expect(
      JSON.stringify(signAndSendTransaction.mock.calls[0], (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ).not.toMatch(
      /privateKey|secretKey|seed/i,
    )
  })

  it("reads views only through the RPC adapter", async () => {
    const { selector } = fakeSelector()
    const rpc = { view: vi.fn().mockResolvedValue([]) } as unknown as NearRpc
    const client = createGroupVaultClient(selector as never, rpc, "gv.testnet")
    await client.getGroups(0, 20)
    expect(rpc.view).toHaveBeenCalledWith({
      contractId: "gv.testnet",
      methodName: "get_groups",
      args: { from_index: 0, limit: 20 },
    })
  })

  it("surfaces a disconnected wallet instead of signing locally", async () => {
    const selector = {
      store: { getState: () => ({ selectedWalletId: null }) },
      wallet: vi.fn(),
    }
    const client = createGroupVaultClient(selector as never, fakeRpc(), "gv.testnet")
    await expect(
      client.createGroup(
        "alice.testnet",
        {
          name: "G",
          description: "",
          joinFee: "1",
          joinFt: "ft.testnet",
          initialMembers: [],
        },
        "100",
      ),
    ).rejects.toThrow("Wallet is not connected")
    expect(selector.wallet).not.toHaveBeenCalled()
  })
})

describe("FT adapter", () => {
  it("sends exactly one yoctoNEAR with the canonical join message", async () => {
    const { selector, signAndSendTransaction } = fakeSelector()
    await joinGroup(selector as never, {
      signerId: "bob.testnet",
      groupId: 7,
      joinFt: "ft.testnet",
      amount: "1000000",
      contractId: "gv.testnet",
    })

    const call = signAndSendTransaction.mock.calls[0][0]
    expect(call.receiverId).toBe("ft.testnet")
    expect(call.actions[0].functionCall.methodName).toBe("ft_transfer_call")
    expect(call.actions[0].functionCall.deposit).toBe(BigInt(ONE_YOCTO))
    const args = JSON.parse(
      Buffer.from(call.actions[0].functionCall.args).toString("utf8"),
    )
    expect(args).toMatchObject({
      receiver_id: "gv.testnet",
      amount: "1000000",
      msg: JSON.stringify({ action: "join", group_id: 7 }),
    })
    expect(buildJoinMessage(7)).toBe('{"action":"join","group_id":7}')
  })
})

describe("Sputnik payloads", () => {
  it("uses the exact TokenWeight policy and proposal kinds", () => {
    expect(tokenWeightPolicyUpdate()).toEqual({
      ChangePolicyUpdateDefaultVotePolicy: {
        vote_policy: {
          weight_kind: "TokenWeight",
          quorum: "0",
          threshold: [1, 2],
        },
      },
    })
    expect(setStakingContractKind("staking.testnet")).toEqual({
      SetStakingContract: { staking_id: "staking.testnet" },
    })
    expect(
      transferKind({ receiverId: "bob.testnet", amount: "1000000000000000000000000" }),
    ).toEqual({
      Transfer: {
        receiver_id: "bob.testnet",
        amount: "1000000000000000000000000",
        token_id: "",
        msg: null,
      },
    })
    expect(addProposalAction({ description: "x", kind: {} }).methodName).toBe(
      "add_proposal",
    )
  })

  it("actProposal includes the exact proposal kind and memo", () => {
    const kind = setStakingContractKind("staking.testnet")
    expect(actProposalAction(4, "VoteApprove", kind)).toEqual({
      methodName: "act_proposal",
      args: {
        id: 4,
        action: "VoteApprove",
        proposal: kind,
        memo: null,
      },
    })
  })
})

describe("staking adapter", () => {
  it("builds storage_deposit, empty-msg FT transfer, and delegate in order", async () => {
    const { selector, signAndSendTransaction } = fakeSelector()
    const client = createStakingClient(selector as never, fakeRpc())

    await client.storageDeposit("alice.testnet", "staking.testnet", "alice.testnet")
    await client.depositStake("alice.testnet", "ft.testnet", "staking.testnet", "100")
    await client.delegate("alice.testnet", "staking.testnet", "alice.testnet", "100")

    const calls = signAndSendTransaction.mock.calls.map((call) => call[0])
    expect(calls[0].receiverId).toBe("staking.testnet")
    expect(calls[0].actions[0].functionCall.methodName).toBe("storage_deposit")

    expect(calls[1].receiverId).toBe("ft.testnet")
    expect(calls[1].actions[0].functionCall.methodName).toBe("ft_transfer_call")
    expect(calls[1].actions[0].functionCall.deposit).toBe(BigInt(1))
    const args = JSON.parse(
      Buffer.from(calls[1].actions[0].functionCall.args).toString("utf8"),
    )
    expect(args).toMatchObject({ receiver_id: "staking.testnet", msg: "" })

    expect(calls[2].actions[0].functionCall.methodName).toBe("delegate")
  })
})

describe("indexer adapter", () => {
  it("requests a bounded cursor page and surfaces HTTP failure", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], next_cursor: null }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("nope", { status: 503 }))

    await expect(
      getMessages("http://127.0.0.1:8787", 3, "abc", fetcher),
    ).resolves.toEqual({ items: [], next_cursor: null })
    const url = fetcher.mock.calls[0][0] as URL
    expect(url.searchParams.get("group_id")).toBe("3")
    expect(url.searchParams.get("cursor")).toBe("abc")

    await expect(
      getMessages("http://127.0.0.1:8787", 3, null, fetcher),
    ).rejects.toThrow("HTTP 503")
  })
})

describe("NearRpc", () => {
  it("encodes view args and decodes base64 result bytes", async () => {
    const payload = Buffer.from(JSON.stringify({ ok: true }), "utf8").toString(
      "base64",
    )
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "x",
          result: {
            result: Array.from(Buffer.from(JSON.stringify({ ok: true }))),
            block_height: 1,
            block_hash: "h",
            logs: [],
          },
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetcher)
    const rpc = new NearRpc({
      network: "testnet",
      rpcUrl: "https://rpc.testnet.near.org",
      groupVaultContractId: "gv.testnet",
      joinFtContractId: "ft.testnet",
      factoryId: "sputnikv2.testnet",
      indexerUrl: "http://127.0.0.1:8787",
    })

    const value = await rpc.view<{ ok: boolean }>({
      contractId: "gv.testnet",
      methodName: "get_group",
      args: { group_id: 1 },
    })
    expect(value).toEqual({ ok: true })
    expect(payload.length).toBeGreaterThan(0)
    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.params.request_type).toBe("call")
    expect(body.params.finality).toBe("final")
    expect(
      Buffer.from(body.params.args_base64, "base64").toString("utf8"),
    ).toBe('{"group_id":1}')
    vi.unstubAllGlobals()
  })
})

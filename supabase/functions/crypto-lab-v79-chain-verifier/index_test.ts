import {
  fixtureSelfTest,
  parseEthereumTransfer,
  parseSolanaTransfer,
  tronAddressHex,
} from "./index.ts";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("fixture self-test passes without wallet access", async () => {
  const result = await fixtureSelfTest();
  assert(result.ethereum === true, "Ethereum fixture failed");
  assert(result.solana === true, "Solana fixture failed");
  assert(result.tron_base58 === true, "TRON checksum fixture failed");
  assert(result.version === "7930-rpc1", "Verifier version mismatch");
});

Deno.test("Ethereum parser rejects a transfer to another recipient", () => {
  const token = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const expectedRecipient = "0xbcd27864ea603643bc8aebb3fe2cec2ffdb39eb9";
  const otherRecipient = "0x1111111111111111111111111111111111111111";
  let rejected = false;
  try {
    parseEthereumTransfer(
      {
        status: "0x1",
        blockNumber: "0x10",
        logs: [{
          address: token,
          topics: [
            TRANSFER_TOPIC,
            `0x${"0".repeat(64)}`,
            `0x${otherRecipient.slice(2).padStart(64, "0")}`,
          ],
          data: "0x2710",
        }],
      },
      { from: otherRecipient },
      token,
      expectedRecipient,
    );
  } catch (error) {
    rejected = error instanceof Error &&
      error.message === "TRANSFER_LOG_NOT_FOUND";
  }
  assert(rejected, "Wrong Ethereum recipient was accepted");
});

Deno.test("Solana parser uses positive recipient token delta", () => {
  const mint = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
  const owner = "EkNNjreEnhvigAnxY7kL2po3SaVXicCk1CLFyJkkv55F";
  const transfer = parseSolanaTransfer(
    {
      slot: 20,
      meta: {
        err: null,
        preTokenBalances: [{
          accountIndex: 1,
          mint,
          owner,
          uiTokenAmount: { amount: "2500" },
        }],
        postTokenBalances: [{
          accountIndex: 1,
          mint,
          owner,
          uiTokenAmount: { amount: "12500" },
        }],
      },
      transaction: {
        message: {
          accountKeys: [{ pubkey: "Sender111111111111111111111111111111111" }],
        },
      },
    },
    mint,
    owner,
  );
  assert(transfer.amount_base_units === "10000", "Wrong Solana delta");
  assert(transfer.execution_success, "Successful Solana fixture rejected");
});

Deno.test("TRON address checksum rejects a modified address", async () => {
  const valid = await tronAddressHex("TKvGfxac4bpFVjdif9vVGoUENBHkidR1WA");
  assert(valid.startsWith("41"), "Valid TRON address failed");

  let rejected = false;
  try {
    await tronAddressHex("TKvGfxac4bpFVjdif9vVGoUENBHkidR1WB");
  } catch (error) {
    rejected = error instanceof Error &&
      ["INVALID_TRON_CHECKSUM", "INVALID_TRON_ADDRESS"].includes(error.message);
  }
  assert(rejected, "Modified TRON address was accepted");
});

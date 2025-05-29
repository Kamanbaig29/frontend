import { sha256 } from "js-sha256";
import {
  TransactionInstruction,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createInitializeAccountInstruction, getAccount } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";

/**
 * Calculate Anchor discriminator for an account or instruction.
 * @param name Format must be like "account:StructName" or "global:instructionName"
 * @returns Buffer of 8-byte discriminator
 */
function calculateDiscriminator(name: string): Buffer {
  const hash = sha256.digest(name); // Uint8Array (32 bytes)
  const first8Bytes = hash.slice(0, 8); // first 8 bytes
  return Buffer.from(first8Bytes);
}

export async function buyToken({
  userKeypair,
  connection,
  programId,
  amount,
  minOut,
  swapAccounts,
}: {
  userKeypair: any;
  connection: any;
  programId: PublicKey;
  amount: bigint | number;
  minOut: bigint | number;
  swapAccounts: {
    user: PublicKey;
    globalConfig: PublicKey;
    feeRecipient: PublicKey;
    bondingCurve: PublicKey;
    tokenMint: PublicKey;
    curveTokenAccount: PublicKey;
    userTokenAccount: PublicKey;
    tokenProgram: PublicKey;
    associatedTokenProgram: PublicKey;
    systemProgram: PublicKey;
  };
}) {
  console.log("🔧 Preparing to buy token...");

  const discriminator = calculateDiscriminator("global:swap");
  console.log("🔑 Discriminator (hex):", discriminator.toString("hex"));

  const direction = 0; // buy = 0

  const data = Buffer.alloc(25);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(BigInt(amount), 8);
  data.writeUInt8(direction, 16);
  data.writeBigUInt64LE(BigInt(minOut), 17);

  console.log("📦 Encoded instruction data:", data.toString("hex"));

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: swapAccounts.user, isSigner: true, isWritable: true },
      { pubkey: swapAccounts.globalConfig, isSigner: false, isWritable: false },
      { pubkey: swapAccounts.feeRecipient, isSigner: false, isWritable: true },
      { pubkey: swapAccounts.bondingCurve, isSigner: false, isWritable: true },
      { pubkey: swapAccounts.tokenMint, isSigner: false, isWritable: false },
      { pubkey: swapAccounts.curveTokenAccount, isSigner: false, isWritable: true },
      { pubkey: swapAccounts.userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: swapAccounts.tokenProgram, isSigner: false, isWritable: false },
      { pubkey: swapAccounts.associatedTokenProgram, isSigner: false, isWritable: false },
      { pubkey: swapAccounts.systemProgram, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  console.log("🚀 Instruction created with keys:");
  instruction.keys.forEach((k, i) =>
    console.log(
      `  [${i}] Pubkey: ${k.pubkey.toBase58()}, Signer: ${k.isSigner}, Writable: ${k.isWritable}`
    )
  );

  // Check if curveTokenAccount exists, else abort
  try {
    await getAccount(connection, swapAccounts.curveTokenAccount);
    // Account exists, proceed
  } catch (e) {
    console.error("❌ curveTokenAccount does not exist. Wait for program to create it (usually via launch).");
    return;
  }

  // Transaction
  const tx = new Transaction().add(instruction);

  try {
    console.log("📤 Sending transaction...");
    const signature = await connection.sendTransaction(tx, [userKeypair]);
    console.log("✅ Transaction sent with signature:", signature);

    console.log("⏳ Waiting for confirmation...");
    await connection.confirmTransaction(signature);
    console.log("🎉 Transaction confirmed!");
  } catch (error: any) {
    console.error("❌ Error sending transaction:", error);

    if (error?.transactionLogs && Array.isArray(error.transactionLogs)) {
      console.error("Transaction Logs:");
      for (const log of error.transactionLogs) {
        console.error(log);
      }
    } else if (error?.logs && Array.isArray(error.logs)) {
      console.error("Transaction Logs (alternative 'logs' field):");
      for (const log of error.logs) {
        console.error(log);
      }
    } else {
      console.error("No transaction logs available in error.");
    }
  }
}

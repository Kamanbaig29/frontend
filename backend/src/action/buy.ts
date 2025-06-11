import { sha256 } from "js-sha256";
import {
  TransactionInstruction,
  Transaction,
  PublicKey,
  Connection,
  Keypair,
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

interface BuyTokenParams {
  connection: Connection;
  userKeypair: Keypair;
  programId: PublicKey;
  amount: number;
  minOut: number;
  direction: number;
  swapAccounts: any; // Replace 'any' with your actual SwapAccounts type
}

export async function buyToken({
  connection,
  userKeypair,
  programId,
  amount,
  minOut,
  direction,
  swapAccounts,
}: BuyTokenParams): Promise<string | undefined> {  // Update return type
  console.log("💸 Initiating buy...");

  const discriminator = calculateDiscriminator("global:swap");
  const data = Buffer.alloc(25);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(BigInt(amount), 8);
  data.writeUInt8(direction, 16);
  data.writeBigUInt64LE(BigInt(minOut), 17);

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

  try {
    await getAccount(connection, swapAccounts.curveTokenAccount);
  } catch (e) {
    console.error("❌ Token account not ready");
    return undefined;
  }

  const tx = new Transaction().add(instruction);

  try {
    const signature = await connection.sendTransaction(tx, [userKeypair]);
    return signature;
  } catch (error: any) {
    console.error("❌ Buy failed:", error.message);
    return undefined;
  }
}

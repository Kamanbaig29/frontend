import { sha256 } from "js-sha256";
import {
  TransactionInstruction,
  Transaction,
  PublicKey,
  Connection,
  Keypair,
} from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";

function calculateDiscriminator(name: string): Buffer {
  const hash = sha256.digest(name);
  return Buffer.from(hash.slice(0, 8));
}

interface SwapAccounts {
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
}

interface SellTokenParams {
  connection: Connection;
  userKeypair: Keypair;
  programId: PublicKey;
  amount: bigint; // smallest units
  minOut: bigint; // smallest units
  swapAccounts: SwapAccounts;
}

export async function sellToken({
  connection,
  userKeypair,
  programId,
  amount,
  minOut,
  swapAccounts,
}: SellTokenParams): Promise<string | undefined> {
  const discriminator = calculateDiscriminator("global:swap");

  const data = Buffer.alloc(25);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);
  data.writeUInt8(1, 16); // sell
  data.writeBigUInt64LE(minOut, 17);

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

  // Check curveTokenAccount exists before sending
  try {
    await getAccount(connection, swapAccounts.curveTokenAccount);
  } catch (e) {
    console.error("curveTokenAccount does not exist yet.");
    return undefined;
  }

  const tx = new Transaction().add(instruction);

  try {
    const sig = await connection.sendTransaction(tx, [userKeypair]);
    console.log("Sell tx sent:", sig);
    return sig;
  } catch (err: any) {
    console.error("Sell tx error:", err);
    if (err.logs) {
      for (const log of err.logs) console.error(log);
    }
    return undefined;
  }
}

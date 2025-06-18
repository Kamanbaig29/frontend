import { sha256 } from "js-sha256";
import {
  TransactionInstruction,
  Transaction,
  PublicKey,
  Connection,
  Keypair,
  ComputeBudgetProgram,
  SystemProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createInitializeAccountInstruction, getAccount } from "@solana/spl-token";

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
  swapAccounts: any;
  slippage?: number;
  priorityFee?: number;
  bribeAmount?: number;
}

export async function buyToken({
  connection,
  userKeypair,
  programId,
  amount,
  minOut,
  direction,
  swapAccounts,
  slippage = 0,
  priorityFee = 0,
  bribeAmount = 0
}: BuyTokenParams): Promise<string | undefined> {
  console.log("\n=== 💸 BUY TOKEN INITIATED ===");
  
  // Amount ko SOL mein convert karke log karenge
  const amountInSol = amount / 1e9;
  
  // Contract ke liye amount ko 1000 se divide karenge
  const adjustedAmount = Math.floor(amount / 1000);
  
  // Network fee buffer (0.002 SOL)
  const networkFeeBuffer = 2_000_000;
  
  // Max allowed amount calculate karenge (sab fees ke sath)
  const maxAllowedAmount = (amount + priorityFee + bribeAmount + networkFeeBuffer) * (1 + slippage / 100);
  
  // Total required amount calculate karenge
  const totalRequired = amount + priorityFee + bribeAmount + networkFeeBuffer;
  
  console.log("Parameters:", {
    amount: amountInSol + " SOL",
    adjustedAmount: (adjustedAmount / 1e9) + " SOL",
    minOut: minOut,
    direction: direction,
    slippage: slippage + "%",
    priorityFee: priorityFee / 1e9 + " SOL",
    bribeAmount: bribeAmount / 1e9 + " SOL",
    totalRequired: totalRequired / 1e9 + " SOL",
    maxAllowedAmount: maxAllowedAmount / 1e9 + " SOL"
  });

  // Check karenge ke total required amount max allowed amount se zyada to nahi hai
  if (totalRequired > maxAllowedAmount) {
    console.error(`❌ Total required amount (${totalRequired / 1e9} SOL) exceeds max allowed amount (${maxAllowedAmount / 1e9} SOL)`);
    return undefined;
  }

  // Calculate minOut with slippage
  const minOutWithSlippage = slippage === 0 ? minOut : Math.floor(minOut * (1 - slippage / 100));
  console.log("Min Out with Slippage:", minOutWithSlippage);

  const discriminator = calculateDiscriminator("global:swap");
  const data = Buffer.alloc(25);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(BigInt(adjustedAmount), 8);
  data.writeUInt8(direction, 16);
  data.writeBigUInt64LE(BigInt(minOutWithSlippage), 17);

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

  const tx = new Transaction();

  // IMPORTANT: Set fee payer before adding any instructions
  tx.feePayer = userKeypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  // Add priority fee if specified
  if (priorityFee > 0) {
    console.log("Adding Priority Fee:", priorityFee / 1e9 + " SOL");
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: Math.floor(priorityFee / 1e6) // Convert to microLamports
      })
    );
  }

  // Add bribe if specified
  if (bribeAmount > 0) {
    console.log("Adding Bribe Amount:", bribeAmount / 1e9 + " SOL");
    tx.add(
      SystemProgram.transfer({
        fromPubkey: userKeypair.publicKey,
        toPubkey: swapAccounts.feeRecipient,
        lamports: bribeAmount
      })
    );
  }

  // Add buy instruction
  tx.add(instruction);

  try {
    // IMPORTANT: Simulate transaction first
    const simulation = await connection.simulateTransaction(tx);
    if (simulation.value.err) {
      console.error("❌ Transaction simulation failed:", simulation.value.err);
      return undefined;
    }

    console.log("Sending transaction...");
    const signature = await connection.sendTransaction(tx, [userKeypair]);
    console.log("✅ Buy transaction sent:", signature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);
    if (confirmation.value.err) {
      console.error("❌ Transaction failed:", confirmation.value.err);
      return undefined;
    }

    return signature;
  } catch (error: any) {
    console.error("❌ Buy failed:", error.message);
    return undefined;
  }
}

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { getSwapAccounts } from "./getSwapAccounts";
import { buyToken } from "./buy";

interface ManualBuyResult {
  success: boolean;
  signature?: string;
  message?: string;
  error?: string;
  details?: {
    mintAddress: string;
    amount: number;
    price: number;
    timestamp: number;
    transactionFee?: number;
    slippage?: number;
    priorityFee?: number;
    bribeAmount?: number;
    userTokenAccount: string; // Added this field
  };
}

export async function handleManualBuy(
  mintAddress: string,
  amount: number,
  privateKeyOrKeypair: string | Keypair,
  connection: Connection,
  programId: PublicKey,
  options?: {
    slippage?: number;
    priorityFee?: number;
    bribeAmount?: number;
  }
): Promise<ManualBuyResult> {
  console.log("\n🛒 Starting manual buy process...");
  console.log("----------------------------------------");
  console.log(`🎯 Mint Address: ${mintAddress}`);
  console.log(`💰 Amount: ${amount} lamports (${amount / 1e9} SOL)`);
  console.log(`📊 Slippage: ${options?.slippage || 1}%`);
  console.log(`⚡ Priority Fee: ${options?.priorityFee || 0.001} SOL`);
  console.log(`💰 Bribe Amount: ${options?.bribeAmount || 0} SOL`);
  console.log("----------------------------------------\n");

  try {
    // 1. Validate inputs
    console.log("1️⃣ Validating inputs...");
    if (!mintAddress || !amount || !privateKeyOrKeypair) {
      throw new Error("Missing required parameters");
    }

    // 2. Handle keypair creation
    console.log("2️⃣ Processing keypair...");
    let userKeypair: Keypair;
    
    if (privateKeyOrKeypair instanceof Keypair) {
      userKeypair = privateKeyOrKeypair;
      console.log(`✅ Using provided keypair`);
    } else {
      try {
        const secretKey = Uint8Array.from(JSON.parse(privateKeyOrKeypair));
        userKeypair = Keypair.fromSecretKey(secretKey);
        console.log(`✅ Keypair created from private key`);
      } catch (error) {
        console.error("❌ Failed to create keypair:", error);
        throw new Error("Invalid private key format");
      }
    }
    
    console.log(`👤 Public Key: ${userKeypair.publicKey.toBase58()}`);

    // 3. Validate mint address
    console.log("\n3️⃣ Validating mint address...");
    try {
      const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mintAddress));
      if (!mintInfo.value) {
        throw new Error("Mint account not found");
      }
      console.log("✅ Mint address is valid");
    } catch (error) {
      console.error("❌ Invalid mint address:", error);
      throw new Error("Invalid mint address");
    }

    // 4. Get swap accounts
    console.log("\n4️⃣ Fetching swap accounts...");
    const swapAccounts = await getSwapAccounts({
      mintAddress,
      buyer: userKeypair.publicKey,
      connection,
      programId,
    });
    console.log("✅ Swap accounts fetched successfully");
    console.log("📊 Swap Account Details:");
    console.log(`- Bonding Curve: ${swapAccounts.bondingCurve.toBase58()}`);
    console.log(`- Token Mint: ${swapAccounts.tokenMint.toBase58()}`);
    console.log(`- User Token Account: ${swapAccounts.userTokenAccount.toBase58()}`);

    // 5. Calculate ATA for curve token account
    console.log("\n5️⃣ Calculating Associated Token Account...");
    const curveTokenATA = await getAssociatedTokenAddress(
      swapAccounts.tokenMint,
      swapAccounts.bondingCurve,
      true
    );
    console.log(`✅ ATA calculated: ${curveTokenATA.toBase58()}`);

    // 6. Check if ATA exists
    console.log("\n6️⃣ Checking if ATA exists...");
    const ataInfo = await connection.getAccountInfo(curveTokenATA);
    if (!ataInfo) {
      console.log("⚠️ ATA doesn't exist, creating...");
      try {
        const createAtaIx = createAssociatedTokenAccountInstruction(
          userKeypair.publicKey,
          curveTokenATA,
          swapAccounts.bondingCurve,
          swapAccounts.tokenMint
        );

        const createAtaTx = new Transaction().add(createAtaIx);
        createAtaTx.feePayer = userKeypair.publicKey;
        createAtaTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        createAtaTx.sign(userKeypair);

        const signature = await connection.sendRawTransaction(createAtaTx.serialize());
        await connection.confirmTransaction(signature, "confirmed");
        console.log("✅ ATA created successfully");
      } catch (error) {
        console.error("❌ Failed to create ATA:", error);
        throw new Error("Failed to create associated token account");
      }
    } else {
      console.log("✅ ATA already exists");
    }

    // 7. Prepare buy transaction with new parameters
    console.log("\n7️⃣ Preparing buy transaction...");
    const slippage = options?.slippage || 1;
    const priorityFeeLamports = options?.priorityFee ? Math.floor(options.priorityFee * 1e9) : 1_000_000;
    const bribeAmountLamports = options?.bribeAmount ? Math.floor(options.bribeAmount * 1e9) : 0;

    // Calculate total required amount including fees
    const totalRequired = amount + priorityFeeLamports + bribeAmountLamports + 10_000_000;

    // Check wallet balance
    const balance = await connection.getBalance(userKeypair.publicKey);
    if (balance < totalRequired) {
      throw new Error(`Insufficient balance. Need ${totalRequired / 1e9} SOL (including fees)`);
    }

    // 8. Execute buy transaction with new parameters
    console.log("\n8️⃣ Executing buy transaction...");
    try {
      const signature = await buyToken({
        connection,
        userKeypair,
        programId,
        amount: amount,
        minOut: 1,
        direction: 0,
        swapAccounts: {
          ...swapAccounts,
          curveTokenAccount: curveTokenATA,
        },
        slippage: slippage,
        priorityFee: priorityFeeLamports,
        bribeAmount: bribeAmountLamports
      });

      if (!signature) {
        throw new Error("Transaction failed - no signature returned");
      }

      console.log(`✅ Transaction sent! Signature: ${signature}`);

      // 9. Wait for confirmation
      console.log("\n9️⃣ Waiting for transaction confirmation...");
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: (await connection.getLatestBlockhash()).blockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
      });

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
      }

      // 10. Get transaction details
      console.log("\n🔟 Fetching transaction details...");
      const txDetails = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!txDetails) {
        throw new Error("Failed to fetch transaction details");
      }

      console.log("\n✨ Transaction successful!");
      console.log("----------------------------------------");
      console.log(`📝 Signature: ${signature}`);
      console.log(`📊 Block: ${txDetails.slot}`);
      console.log(`💰 Fee: ${txDetails.meta?.fee} lamports`);
      console.log("----------------------------------------\n");

      // FIX: Added userTokenAccount to details
      return {
        success: true,
        signature,
        message: "Token bought successfully",
        details: {
          mintAddress,
          amount: amount / 1e9,
          price: amount / 1e9,
          timestamp: Date.now(),
          transactionFee: txDetails.meta?.fee,
          slippage: slippage,
          priorityFee: priorityFeeLamports / 1e9,
          bribeAmount: bribeAmountLamports / 1e9,
          userTokenAccount: swapAccounts.userTokenAccount.toBase58() // Added this line
        },
      };
    } catch (error) {
      console.error("❌ Buy transaction failed:", error);
      throw error;
    }
  } catch (error) {
    console.error("\n❌ Manual buy failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
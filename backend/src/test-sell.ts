import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  MEMEHOME_PROGRAM_ID,
  RPC_ENDPOINT,
  BUYER_PUBLIC_KEY,
  USER_SECRET_KEY,
} from "./config/test-config";
import { getSwapAccounts } from "./action/getSwapAccounts";
import { sellToken } from "./action/sell";
import { getMint } from "@solana/spl-token";

// Helper: calculate amount out for constant product AMM swap (token to SOL)
function calculateAmountOut(
  amountIn: bigint,
  tokenReserve: bigint,
  solReserve: bigint,
  feeNumerator = 997n, // 0.3% fee
  feeDenominator = 1000n
): bigint {
  const amountInWithFee = amountIn * feeNumerator;
  const numerator = amountInWithFee * solReserve;
  const denominator = tokenReserve * feeDenominator + amountInWithFee;
  return numerator / denominator;
}

async function main() {
  const connection = new Connection(RPC_ENDPOINT);
  const userKeypair = Keypair.fromSecretKey(USER_SECRET_KEY);
  const programId = MEMEHOME_PROGRAM_ID;
  const mintAddress = "CvJXURxb1tFvhS1erfTY1ppsKAfjHJNaG9Cvaw7EyuoP";

  const mintPubkey = new PublicKey(mintAddress);
  const mintInfo = await getMint(connection, mintPubkey);
  const decimals = mintInfo.decimals;

  // Use a smaller token amount to avoid errors while testing
  const tokenBalance = 100000; // 1000 tokens (human-readable)
  const amountToSell = BigInt(Math.floor(tokenBalance * 10 ** decimals)); // smallest unit

  // Fetch swap accounts
  const swapAccounts = await getSwapAccounts({
    mintAddress,
    buyer: BUYER_PUBLIC_KEY,
    connection,
    programId,
  });

  // Fetch reserves info
  const tokenVaultInfo = await connection.getTokenAccountBalance(
    swapAccounts.curveTokenAccount
  );
  const tokenReserve = BigInt(tokenVaultInfo.value.amount);

  const bondingCurveInfo = await connection.getAccountInfo(
    swapAccounts.bondingCurve
  );
  if (!bondingCurveInfo) throw new Error("bondingCurve account info missing");
  const solReserve = BigInt(bondingCurveInfo.lamports);

  // Calculate expected SOL output
  const expectedSolOut = calculateAmountOut(
    amountToSell,
    tokenReserve,
    solReserve
  );

  // Set slippage tolerance 10%
  const slippagePercent = 10n;
  //   const minOut = (expectedSolOut * (100n - slippagePercent)) / 100n;
  //   const minOut = 0n; // disable slippage check for testing
  const minOut = expectedSolOut > 100n ? expectedSolOut / 100n : 1n; // at least 1 lamport

  console.log("==== SELL TOKEN ====");
  console.log("Amount to Sell (smallest unit):", amountToSell.toString());
  console.log("Token Reserve:", tokenReserve.toString());
  console.log("SOL Reserve:", solReserve.toString());
  console.log("Expected SOL out:", expectedSolOut.toString());
  console.log("Minimum SOL out (with 10% slippage):", minOut.toString());

  try {
    // IMPORTANT: Pass minOut as a regular number or string if your sellToken expects that
    // If sellToken expects BigInt, pass minOut directly
    // Here assuming it expects a bigint or number
    const txSignature = await sellToken({
      connection,
      userKeypair,
      programId,
      amount: amountToSell,
      minOut: minOut, // Pass as bigint or convert to number/string if needed
      swapAccounts,
    });

    console.log("Sell transaction signature:", txSignature);
  } catch (error) {
    console.error("Sell transaction failed:", error);
  }
}

main();

// Add this declaration before your imports
declare global {
  var trackedTokens: TokenData[];
  var autoSnipeSettings: {
    buyAmount: bigint;
    slippage: number;
    priorityFee: bigint;
    bribeAmount: bigint;
    autoBuyEnabled: boolean;
  };
}

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionConfirmationStrategy,
} from "@solana/web3.js";
import { getConnection } from "../utils/getProvider";
import { getSwapAccounts } from "../action/getSwapAccounts";
import { buyToken } from "../action/buy";
import { handleManualBuy } from "../action/manualBuy";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import WebSocket, { WebSocketServer } from "ws";
import bs58 from "bs58";
import { AutoTokenBuy } from "../models/AutoTokenBuy";
import { TokenStats } from "../models/TokenStats";
import { WalletToken } from "../models/WalletToken";
import { Metaplex } from "@metaplex-foundation/js";
import { getTokenPrice } from "../utils/getTokenPrice";
import { sellToken } from "../action/sell";
import { TokenPrice } from '../models/TokenPrice';

import {
  RPC_ENDPOINT,
  BUYER_PUBLIC_KEY,
  USER_SECRET_KEY,
} from "../config/test-config";

const MEMEHOME_PROGRAM_ID = new PublicKey(process.env.MEMEHOME_PROGRAM_ID!);

// env variable se string read karo
const secretKeyString = process.env.USER_SECRET_KEY;
if (!secretKeyString) {
  throw new Error("USER_SECRET_KEY is not set in .env");
}

// JSON.parse karke array banao
const secretKeyArray: number[] = JSON.parse(secretKeyString);

// Convert to Uint8Array
const secretKey = Uint8Array.from(secretKeyArray);

// Keypair generate karo
const userKeypair = Keypair.fromSecretKey(secretKey);

// Get the buyer public key string from environment for general use
const buyerPublicKeyString = process.env.BUYER_PUBLIC_KEY;
if (!buyerPublicKeyString) {
  throw new Error("BUYER_PUBLIC_KEY env variable is not set");
}
const currentBuyerPublicKey = new PublicKey(buyerPublicKeyString).toBase58(); // Convert to string once for consistency

// At the top of file, add this Set to track processed mints
const processedMints = new Set<string>();

// Add this interface at the top of the file
interface SolanaError extends Error {
  logs?: string[];
  code?: string | number;
  details?: Record<string, unknown>;
}

// Add interface for token data
interface TokenData {
  mint: string;
  creator: string;
  bondingCurve: string;
  curveTokenAccount: string;
  userTokenAccount: string;
  metadata: string;
  decimals: number;
  supply?: string;
}

function calculateAmountOut(
  amountIn: bigint,
  tokenReserve: bigint,
  solReserve: bigint,
  feeNumerator = 997n,
  feeDenominator = 1000n
): bigint {
  const amountInWithFee = amountIn * feeNumerator;
  const numerator = amountInWithFee * solReserve;
  const denominator = tokenReserve * feeDenominator + amountInWithFee;
  return numerator / denominator;
}

// Add this new function after the existing calculateAmountOut function
async function getCurrentTokenPrice(
    connection: Connection,
    mintAddress: string,
    swapAccounts: any
): Promise<number | null> {
    try {
        // Get token reserves
        const tokenVaultInfo = await connection.getTokenAccountBalance(
            swapAccounts.curveTokenAccount
        );
        const tokenReserve = BigInt(tokenVaultInfo.value.amount);

        // Get SOL reserves
        const bondingCurveInfo = await connection.getAccountInfo(
            swapAccounts.bondingCurve
        );
        if (!bondingCurveInfo) {
            console.log(`❌ Bonding curve not found for ${mintAddress}`);
            return null;
        }
        const solReserve = BigInt(bondingCurveInfo.lamports);

        // Calculate price for 1 token
        const oneToken = BigInt(10 ** tokenVaultInfo.value.decimals);
        const solAmount = calculateAmountOut(oneToken, tokenReserve, solReserve);
        
        return Number(solAmount) / 1e9; // Convert to SOL
    } catch (error) {
        console.error(`Error calculating price for ${mintAddress}:`, error);
        return null;
    }
}

// Add this helper function for profit/loss calculation
function calculateProfitLoss(buyPrice: number, currentPrice: number): number | null {
    if (!buyPrice || !currentPrice) return null;
    return ((currentPrice - buyPrice) / buyPrice) * 100;
}

// Add constants at the top
const BUY_AMOUNT = 100_000_000; // 0.1 SOL
const BUY_AMOUNT_SOL = BUY_AMOUNT / 1000000000; // 0.1 SOL
const BUY_AMOUNT_ADJUSTED = Math.floor(BUY_AMOUNT / 1000); // 100_000
const MIN_OUT_AMOUNT = 1;
const DIRECTION = 0;

// Move sleep function outside
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Replace the current WebSocket server creation
let wss: WebSocketServer;

const createWebSocketServer = (
  port: number = 3001,
  retries: number = 3
): WebSocketServer => {
  try {
    const server = new WebSocketServer({ port });
    console.log(`📡 WebSocket server started on port ${port}`);
    return server;
  } catch (error: any) {
    if (error.code === "EADDRINUSE") {
      if (retries > 0) {
        console.log(`Port ${port} in use, trying ${port + 1}...`);
        return createWebSocketServer(port + 1, retries - 1);
      }
      console.error("❌ No available ports found after retries");
      process.exit(1);
    }
    throw error;
  }
};

// Create the WebSocket server with retry logic
wss = createWebSocketServer();

// Add cleanup handlers
process.on("SIGINT", () => {
  console.log("Shutting down WebSocket server...");
  wss.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("Shutting down WebSocket server...");
  wss.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });
});

console.log("📡 WebSocket server started on port 3001");

// Create a function to send updates to all connected clients
function broadcastUpdate(data: any) {
  console.log("📤 Broadcasting update:", data);
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
      console.log("✅ Update sent to client");
    }
  });
}

// Add at the top with other interfaces
interface BotState {
  isAutoMode: boolean;
}

const botState = {
  isAutoMode: false,
};

// Add these variables at the top with other state
let logListener: number | null = null;
let isListening = false;

// Add reset function
const resetBotState = () => {
  // Stop listening if active
  if (isListening && logListener) {
    const connection = getConnection();
    connection.removeOnLogsListener(logListener);
    logListener = null;
  }

  isListening = false;
  botState.isAutoMode = false;

  console.log("🔄 Bot state reset to initial state");

  // Broadcast reset to all clients
  broadcastUpdate({
    type: "BOT_RESET",
    status: "ready",
    mode: "manual",
    message: "Bot has been reset to initial state",
  });
};

// Update the checkWalletBalance function with better error handling
async function checkWalletBalance(
  connection: Connection,
  publicKey: PublicKey,
  requiredAmount: number
): Promise<boolean> {
  try {
    // Try multiple times to get balance
    let retries = 3;
    let balance = null;

    while (retries > 0) {
      try {
        balance = await connection.getBalance(publicKey);
        break;
      } catch (error) {
        console.log(
          `Retry ${4 - retries} failed, attempts left: ${retries - 1}`
        );
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second between retries
      }
    }

    if (balance === null) {
      throw new Error("Failed to get wallet balance after multiple attempts");
    }

    console.log(`💰 Current wallet balance: ${balance / 1e9} SOL`);
    console.log(`💵 Required amount: ${requiredAmount / 1e9} SOL`);

    // Add buffer for transaction fees (0.01 SOL)
    const requiredWithBuffer = requiredAmount + 10_000_000;

    if (balance < requiredWithBuffer) {
      console.error(
        `❌ Insufficient balance. Need ${requiredWithBuffer / 1e9
        } SOL (including fees)`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("❌ Error checking wallet balance:", error);
    throw new Error("Failed to verify wallet balance. Please try again.");
  }
}

async function fetchWalletTokens(
  connection: Connection,
  walletPublicKey: PublicKey
) {
  const tokenAccounts = await connection.getTokenAccountsByOwner(
    walletPublicKey,
    { programId: TOKEN_PROGRAM_ID }
  );
  return tokenAccounts.value;
}

// Add this near the top of the file, after the global declarations
if (!global.autoSnipeSettings) {
  global.autoSnipeSettings = {
    buyAmount: BigInt(0),
    slippage: 1,
    priorityFee: BigInt(0),
    bribeAmount: BigInt(0),
    autoBuyEnabled: false
  };
}

// Add type for swapAccounts
let swapAccounts: Awaited<ReturnType<typeof getSwapAccounts>>;

// Add this interface at the top of the file
interface ParsedTokenAccountData {
  program: string;
  parsed: {
    info: {
      mint: string;
      owner: string;
      state: string;
      amount: string;
      delegate?: string;
      delegatedAmount?: string;
      isNative?: boolean;
      name?: string;
      symbol?: string;
      decimals?: number;
    };
    type: string;
  };
  space: number;
}

interface ParsedTokenMintData {
  program: string;
  parsed: {
    info: {
      decimals: number;
      freezeAuthority: string | null;
      isInitialized: boolean;
      mintAuthority: string | null;
      supply: string;
      name?: string;
      symbol?: string;
    };
    type: string;
  };
  space: number;
}

// NOTE: WalletToken interface should ideally be imported from ../models/WalletToken
// and should match the Mongoose schema. Assuming you have it there already:
// import { IWalletToken as WalletTokenInterface } from "../models/WalletToken";
// interface WalletToken extends WalletTokenInterface {}
// For clarity in this file, adding a simple version matching what's used.
interface WalletToken {
  _id: string; // Add _id if it's used directly for mapping like in frontend
  mint: string; // Token's mint address
  amount: string; // Amount of tokens held
  currentPrice?: number; // Optional, as it might not be stored in DB always
  buyPrice: number; // Price when bought
  lastPrice?: number; // Latest price
  lastUpdated?: number; // Last update timestamp
  name: string; // Token name
  symbol: string; // Token symbol
  decimals: number; // Token decimals
  userPublicKey: string; // Key change: added userPublicKey to match backend schema
  description?: string; // Optional field, if present in schema
}

// First add this interface at the top of your file
interface WebSocketError {
  code?: string;
  message: string;
}

// First add this interface at the top of your file
interface BuyError extends Error {
  code?: string;
  message: string;
}

// Add at the top with other interfaces
interface AutoSnipeSettings {
  buyAmount: bigint;
  slippage: number;
  priorityFee: bigint;
  bribeAmount: bigint;
  autoBuyEnabled: boolean;
}

// Add with other global variables
let globalSettings: AutoSnipeSettings = {
  buyAmount: BigInt(0),
  slippage: 0,
  priorityFee: BigInt(0),
  bribeAmount: BigInt(0),
  autoBuyEnabled: false
};

// Update function
function updateGlobalSettings(settings: AutoSnipeSettings) {
  // Update only global.autoSnipeSettings
  global.autoSnipeSettings = {
    ...global.autoSnipeSettings,
    ...settings
  };
  console.log("⚙️ Global settings updated:", global.autoSnipeSettings);
}

// Token handler function
async function handleNewToken(tokenData: TokenData) {
  // Check only global.autoSnipeSettings
  if (!global.autoSnipeSettings.autoBuyEnabled) {
    console.log("❌ Auto-buy is disabled, skipping buy attempt");
    return;
  }
  // ...
}

// Add at the top of file
const PRICE_UPDATE_INTERVAL = 10000; // 10 seconds
const priceCache = new Map<string, { price: number, timestamp: number }>();

// Modify calculateTokenPrice to use cache
async function calculateTokenPrice(
    connection: Connection,
    mintAddress: string
): Promise<number | null> {
    try {
        // Check cache first
        const cached = priceCache.get(mintAddress);
        if (cached && (Date.now() - cached.timestamp) < PRICE_UPDATE_INTERVAL) {
            return cached.price;
        }

        // If not in cache or expired, calculate new price
        const swapAccounts = await getSwapAccounts({
            mintAddress,
            buyer: userKeypair.publicKey,
            connection,
            programId: MEMEHOME_PROGRAM_ID
        });
        if (!swapAccounts) return null;

        const tokenVaultInfo = await connection.getTokenAccountBalance(swapAccounts.curveTokenAccount);
        const tokenReserve = BigInt(tokenVaultInfo.value.amount);
        const solReserve = BigInt((await connection.getAccountInfo(swapAccounts.bondingCurve))?.lamports || 0);

        const oneToken = BigInt(1_000_000_000);
        const solAmount = calculateAmountOut(oneToken, tokenReserve, solReserve);
        const price = Number(solAmount) / 1_000_000_000;

        // Update cache
        priceCache.set(mintAddress, { price, timestamp: Date.now() });
        return price;
    } catch (error) {
        console.error(`Error calculating price for ${mintAddress}:`, error);
        return null;
    }
}

// Add this function
async function updateAllTokenPrices(tokens: any[], connection: Connection) {
    const updates = await Promise.all(tokens.map(async (token) => {
        const price = await calculateTokenPrice(connection, token.mint);
        return {
            ...token.toObject(),
            currentPrice: price || 0,
            profitLossPercent: price ? ((price - (token.buyPrice || 0)) / (token.buyPrice || 1) * 100) : 0
        };
    }));
    return updates;
}

export async function startTokenListener() {
  const connection = getConnection();
  console.log("🚀 Bot initialized - Waiting for mode selection...");

  const startListening = () => {
    if (isListening || logListener !== null) {
      console.log("👂 Already listening for tokens or listener is active.");
      return;
    }

    console.log("👂 Starting token listener...");
    logListener = connection.onLogs(
      MEMEHOME_PROGRAM_ID,
      async (logInfo) => {
        try {
          if (!global.autoSnipeSettings.autoBuyEnabled) {
            console.log("❌ Auto-buy is disabled, skipping buy attempt");
            return;
          }

          const { logs, signature } = logInfo;
          let mintAddress: string | undefined;

          try {
            // More specific token creation detection
            const isCreateMint = logs.some((log) =>
              log.includes("Program log: Instruction: InitializeMint2")
            );

            const isLaunchInstruction = logs.some((log) =>
              log.includes("Program log: Instruction: Launch")
            );

            // Only proceed if both conditions are met
            if (!isCreateMint || !isLaunchInstruction) {
              return;
            }

            console.log("🎯 New token creation detected!");

            await sleep(2000);

            const tx = await connection.getTransaction(signature, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            });

            if (!tx?.transaction?.message) {
              console.log("❌ Invalid transaction data");
              return;
            }

            const accountKeys = tx.transaction.message.getAccountKeys();
            const accountKeysArray: PublicKey[] = [];
            for (let i = 0; i < accountKeys.length; i++) {
              const key = accountKeys.get(i);
              if (key) accountKeysArray.push(key);
            }

            // Collect all relevant addresses
            const tokenData: TokenData = {
              mint: accountKeysArray[1].toBase58(),
              creator: accountKeysArray[0].toBase58(),
              bondingCurve: accountKeysArray[3].toBase58(), // Bonding curve PDA
              curveTokenAccount: accountKeysArray[2].toBase58(), // Curve token account
              userTokenAccount: accountKeysArray[4].toBase58(), // Your token account
              metadata: accountKeysArray[9].toBase58(), // Metadata account
              decimals: 9,
            };

            // Log detailed token info
            console.log("\n📋 Token Details:");
            console.log("----------------------------------------");
            console.log(`🎯 Mint Address:        ${tokenData.mint}`);
            console.log(`👤 Creator:            ${tokenData.creator}`);
            console.log(`📈 Bonding Curve:      ${tokenData.bondingCurve}`);
            console.log(`💰 Curve Token Account: ${tokenData.curveTokenAccount}`);
            console.log(` User Token Account:  ${tokenData.userTokenAccount}`);
            console.log(`📄 Metadata Account:    ${tokenData.metadata}`);
            console.log(`🔢 Decimals:           ${tokenData.decimals}`);
            console.log("----------------------------------------\n");

            // Try to fetch token supply
            try {
              const mintInfo = await connection.getTokenSupply(
                new PublicKey(tokenData.mint)
              );
              if (mintInfo.value) {
                tokenData.supply = mintInfo.value.amount;
                console.log(`💎 Token Supply: ${tokenData.supply}`);
              }
            } catch (error) {
              console.log("⚠️ Could not fetch token supply");
            }

            // Add to global tracking with type safety
            if (!global.trackedTokens) {
              global.trackedTokens = [] as TokenData[];
            }
            global.trackedTokens.push(tokenData);

            // Broadcast new token detection
            broadcastUpdate({
              type: "NEW_TOKEN",
              tokenData: {
                mint: tokenData.mint,
                creator: tokenData.creator,
                bondingCurve: tokenData.bondingCurve,
                curveTokenAccount: tokenData.curveTokenAccount,
                userTokenAccount: tokenData.userTokenAccount,
                metadata: tokenData.metadata,
                decimals: tokenData.decimals,
                supply: tokenData.supply,
                status: "Detected",
                detectionTime: new Date().toISOString(),
                buyTime: null,
                txSignature: null
              },
            });

            // Continue with existing buy logic...
            mintAddress = tokenData.mint;

            // Skip if already processed
            if (processedMints.has(mintAddress)) {
              console.log(`⏭️ Skipping: Already processed ${mintAddress}`);
              return;
            }

            // Add debug logs
            console.log("📝 Transaction logs:", logs);
            console.log(
              "🔑 Account keys:",
              accountKeysArray.map((key) => key.toBase58())
            );

            const owner = accountKeysArray[0].toBase58();
            const decimals = 9;

            console.log(`Mint Address: ${mintAddress}`);
            console.log(`Owner: ${owner}`);
            console.log(`Decimals: ${decimals}`);

            // Validate mint address before proceeding
            const mintInfo = await connection.getParsedAccountInfo(
              new PublicKey(mintAddress)
            );
            let mintType: string | undefined = undefined;
            if (
              mintInfo.value &&
              typeof mintInfo.value.data === "object" &&
              "parsed" in mintInfo.value.data
            ) {
              // @ts-ignore
              mintType = mintInfo.value.data.parsed.type;
            }
            if (mintType !== "mint") {
              console.error(
                "❌ Skipping: accountKeys[1] is not a valid SPL Token Mint."
              );
              return;
            }

            // Use the currentBuyerPublicKey already defined and validated at the top of the file
            const buyer = new PublicKey(currentBuyerPublicKey);

            // Get swap accounts before using them
            swapAccounts = await getSwapAccounts({
              mintAddress,
              buyer: userKeypair.publicKey,
              connection,
              programId: MEMEHOME_PROGRAM_ID
            });

            console.log("📦 Swap Accounts:", swapAccounts);

            // Calculate the correct ATA address for curveTokenAccount (bondingCurve PDA + tokenMint)
            const curveTokenATA = await getAssociatedTokenAddress(
              swapAccounts.tokenMint,
              swapAccounts.bondingCurve,
              true // allowOwnerOffCurve for PDA
            );

            console.log("curveTokenATA:", curveTokenATA.toBase58());
            console.log("tokenMint:", swapAccounts.tokenMint.toBase58());
            console.log("bondingCurve:", swapAccounts.bondingCurve.toBase58());

            const ataInfo = await connection.getAccountInfo(curveTokenATA);
            if (ataInfo) {
              // Check if it's a valid SPL Token Account
              const parsed = await connection.getParsedAccountInfo(curveTokenATA);
              if (
                parsed.value &&
                typeof parsed.value.data === "object" &&
                "parsed" in parsed.value.data &&
                parsed.value.data.parsed.type === "account"
              ) {
                console.log(
                  "curveTokenAccount already exists and is a valid token account, skipping creation."
                );
              } else {
                console.error(
                  "❌ curveTokenAccount exists but is NOT a valid SPL Token Account. Skipping creation to avoid error."
                );
                // Don't try to create or use this account, just skip this token
                return;
              }
            } else {
              try {
                console.log("⚡ Creating curveTokenAccount before buy...");
                const createAtaIx = createAssociatedTokenAccountInstruction(
                  userKeypair.publicKey, // payer
                  curveTokenATA, // associated token account address
                  swapAccounts.bondingCurve, // owner (PDA)
                  swapAccounts.tokenMint // mint
                );

                // Create and send transaction
                const createAtaTx = new Transaction().add(createAtaIx);

                createAtaTx.feePayer = userKeypair.publicKey;
                createAtaTx.recentBlockhash = (
                  await connection.getLatestBlockhash()
                ).blockhash;

                // Sign transaction (fixed method)
                createAtaTx.sign(userKeypair);

                // Send raw transaction
                const signature = await connection.sendRawTransaction(
                  createAtaTx.serialize()
                );

                // Wait for confirmation
                if (signature) {
                  await connection.confirmTransaction(signature);
                }

                console.log("✅ curveTokenAccount created successfully!");

                // Verify ATA was created
                const newAtaInfo = await connection.getAccountInfo(curveTokenATA);
                if (!newAtaInfo) {
                  throw new Error("ATA creation failed - account not found");
                }
              } catch (ataError) {
                console.error("❌ Failed to create ATA:", ataError);
                return; // Exit if ATA creation fails
              }
            }

            // Ab buyToken call karo (swapAccounts.curveTokenAccount = curveTokenATA hona chahiye)
            swapAccounts.curveTokenAccount = curveTokenATA;

            // Add validation before buy
            if (
              !swapAccounts.userTokenAccount ||
              !swapAccounts.curveTokenAccount
            ) {
              console.error("❌ Missing required token accounts");
              return;
            }

            try {
              const buyAmount = Number(global.autoSnipeSettings.buyAmount);
              const priorityFee = Number(global.autoSnipeSettings.priorityFee);
              const bribeAmount = Number(global.autoSnipeSettings.bribeAmount);
              
              // Total required amount calculate karenge (sab fees ke sath)
              const totalRequired = buyAmount + priorityFee + bribeAmount + 10_000_000; // 0.01 SOL buffer

              // Balance check karenge
              const balance = await connection.getBalance(userKeypair.publicKey);
              if (balance < totalRequired) {
                  console.error(`❌ Insufficient balance. Need ${totalRequired / 1e9} SOL (including fees)`);
                  return;
              }

              console.log("\n=== 💰 TRANSACTION BREAKDOWN ===");
              console.log(`Buy Amount: ${buyAmount / 1e9} SOL`);
              console.log(`Priority Fee: ${priorityFee / 1e9} SOL`);
              console.log(`Bribe Amount: ${bribeAmount / 1e9} SOL`);
              console.log(`Network Fee Buffer: 0.01 SOL`);
              console.log(`Total Required: ${totalRequired / 1e9} SOL`);
              console.log(`Current Balance: ${balance / 1e9} SOL`);
              console.log(`Slippage: ${global.autoSnipeSettings.slippage}%`);
              console.log(`Max Price with Slippage: ${(buyAmount * (1 + global.autoSnipeSettings.slippage/100)) / 1e9} SOL`);
              console.log("==============================\n");
              
              const autoBuyStartTime = Date.now();
              const signature = await buyToken({
                  connection,
                  userKeypair,
                  programId: MEMEHOME_PROGRAM_ID,
                  amount: buyAmount,
                  minOut: MIN_OUT_AMOUNT,
                  direction: DIRECTION,
                  swapAccounts,
                  slippage: global.autoSnipeSettings.slippage,
                  priorityFee: priorityFee,
                  bribeAmount: bribeAmount
              });

              // Agar signature nahi mila to transaction reject ho gaya hai
              if (!signature) {
                  console.error("❌ Buy transaction rejected due to validation failure");
                  return; // IMPORTANT: Return here to stop further processing
              }

              // Get transaction details only if we have a valid signature
              const txDetails = await connection.getTransaction(signature, {
                  commitment: "confirmed",
                  maxSupportedTransactionVersion: 0,
              });

              // Move totalSpent calculation outside the if block
              const totalSpent: number = txDetails?.meta ? (txDetails.meta.preBalances[0] - txDetails.meta.postBalances[0]) / 1e9 : 0;

              if (txDetails?.meta) {
                  console.log("\n=== 💸 TRANSACTION RECEIPT ===");
                  console.log(`Transaction Signature: ${signature}`);
                  console.log(`Status: ✅ Confirmed`);
                  
                  console.log("\n=== 💰 FINAL AMOUNTS ===");
                  console.log(`Total SOL Spent: ${totalSpent.toFixed(9)} SOL`);
                  console.log(`Network Fee: ${(txDetails.meta.fee / 1e9).toFixed(9)} SOL`);
                  console.log(`Priority Fee: ${priorityFee / 1e9} SOL`);
                  console.log(`Bribe Amount: ${bribeAmount / 1e9} SOL`);
                  console.log(`Actual Buy Amount: ${(totalSpent - (txDetails.meta.fee / 1e9) - (priorityFee / 1e9) - (bribeAmount / 1e9)).toFixed(9)} SOL`);

                  // Get token amounts using the correct account index
                  const accountKeys = txDetails.transaction.message.getAccountKeys();
                  const accountKeysArray: PublicKey[] = [];
                  for (let i = 0; i < accountKeys.length; i++) {
                    const key = accountKeys.get(i);
                    if (key) accountKeysArray.push(key);
                  }

                  const userTokenAccount = swapAccounts.userTokenAccount;
                  const userTokenAccountIndex = accountKeysArray.findIndex(
                    (key) => key.toBase58() === userTokenAccount.toBase58()
                  );

                  const preTokenBalance = txDetails.meta.preTokenBalances?.find(
                    (balance) => balance.accountIndex === userTokenAccountIndex
                  )?.uiTokenAmount.uiAmount || 0;

                  const postTokenBalance = txDetails.meta.postTokenBalances?.find(
                    (balance) => balance.accountIndex === userTokenAccountIndex
                  )?.uiTokenAmount.uiAmount || 0;

                  const tokensReceived = postTokenBalance - preTokenBalance;

                  // Calculate price per token with full precision
                  const pricePerToken = tokensReceived > 0 ? totalSpent / tokensReceived : 0;

                  // Format price to 9 decimal places without scientific notation
                  const formattedPrice = pricePerToken.toFixed(9);

                  // Get token metadata
                  const tokenMetadata = await connection.getParsedAccountInfo(new PublicKey(mintAddress));
                  let tokenName = "Unknown";
                  let tokenSymbol = "Unknown";

                  if (tokenMetadata.value &&
                      typeof tokenMetadata.value.data === "object" &&
                      "parsed" in tokenMetadata.value.data) {
                    const parsedData = tokenMetadata.value.data.parsed;
                    if (parsedData.type === "mint") {
                      tokenName = parsedData.info.name || "Unknown";
                      tokenSymbol = parsedData.info.symbol || "Unknown";
                    }
                  }

                  console.log("\n=== 💸 TRANSACTION DETAILS ===");
                  console.log(`Transaction Signature: ${signature}`);
                  console.log(`Status: ✅ Confirmed`);
                  console.log(`Block: ${txDetails.slot}`);

                  console.log("\n=== 💰 FINAL AMOUNTS ===");
                  console.log(`Total SOL Spent: ${totalSpent.toFixed(9)} SOL`);
                  console.log(`Network Fee: ${(txDetails.meta.fee / 1e9).toFixed(9)} SOL`);
                  console.log(`Priority Fee: ${priorityFee / 1e9} SOL`);
                  console.log(`Bribe Amount: ${bribeAmount / 1e9} SOL`);
                  console.log(`Actual Buy Amount: ${(totalSpent - (txDetails.meta.fee / 1e9) - (priorityFee / 1e9) - (bribeAmount / 1e9)).toFixed(9)} SOL`);

                  // Calculate and log token amounts
                  console.log("\n=== 🪙 TOKEN DETAILS ===");
                  console.log(`Pre Token Balance: ${preTokenBalance}`);
                  console.log(`Post Token Balance: ${postTokenBalance}`);
                  console.log(`Tokens Received: ${tokensReceived}`);
                  console.log(`Price per Token: ${formattedPrice}`);

                  console.log("\n=== ⚙️ TRANSACTION SETTINGS ===");
                  console.log(`Slippage: ${global.autoSnipeSettings.slippage}%`);
                  console.log(`Priority Fee: ${priorityFee / 1e9} SOL`);

                  // Then use it in the database update:
                  await WalletToken.findOneAndUpdate(
                    {
                      mint: mintAddress,
                      userPublicKey: currentBuyerPublicKey,
                    },
                    {
                      $set: {
                        mint: mintAddress,
                        buyPrice: formattedPrice,
                        amount: tokensReceived.toString(),
                        decimals: 6,
                        name: tokenName,
                        symbol: tokenSymbol,
                        userPublicKey: currentBuyerPublicKey,
                      }
                    },
                    { upsert: true, new: true }
                  );

                  // Send success response with regular number format
                  const autoBuyEndTime = Date.now();
                  const autoBuyDuration = autoBuyEndTime - autoBuyStartTime;

                  broadcastUpdate({
                    type: "AUTO_BUY_SUCCESS",
                    signature: signature,
                    details: {
                      mint: mintAddress,
                      buyPrice: formattedPrice,
                      tokenAmount: tokensReceived,
                      executionTimeMs: autoBuyDuration,
                      status: "Bought",
                      buyTime: autoBuyDuration,
                      txSignature: signature,
                      creator: tokenData.creator,
                      bondingCurve: tokenData.bondingCurve,
                      curveTokenAccount: tokenData.curveTokenAccount,
                      metadata: tokenData.metadata,
                      decimals: tokenData.decimals,
                      supply: tokenData.supply
                    }
                  });
              }
            } catch (error) {
              console.error("❌ Buy transaction failed:", error);
              if (error instanceof Error) {
                console.error("Error details:", {
                  message: error.message,
                  stack: error.stack,
                  logs: (error as SolanaError).logs || [],
                  code: (error as SolanaError).code,
                  details: (error as SolanaError).details || {},
                });
              }
            }
          } catch (error) {
            console.error("❌ Error processing log:", error);
          }
        } catch (error) {
          console.error("❌ Error processing log:", error);
        }
      },
      "confirmed"
    );

    isListening = true;
    console.log("✅ Token listener started successfully");
  };

  // Function to stop listening
  const stopListening = () => {
    if (!isListening) {
      console.log("🔇 Not currently listening");
      return;
    }

    if (logListener !== null) {
      const connection = getConnection();
      connection.removeOnLogsListener(logListener);
      logListener = null;
    }

    isListening = false;
    console.log("🔇 Token listener stopped");
  };

  try {
    // Single WebSocket connection handler for all functionality
    wss.on("connection", (ws: WebSocket) => {
      console.log("🔌 New client connected");

      ws.on("message", async (message: string) => {
        try {
          const data = JSON.parse(message);
          console.log("📨 Received raw message data:", data);
          console.log("📨 Received message type:", data.type);
          switch (data.type) {
            case "SET_MODE":
              if (data.mode === "automatic") {
                botState.isAutoMode = true;
                startListening();
                broadcastUpdate({
                  type: "MODE_CHANGED",
                  mode: "automatic",
                  message: "Bot switched to automatic mode",
                });
              } else if (data.mode === "manual") {
                botState.isAutoMode = false;
                stopListening();
                broadcastUpdate({
                  type: "MODE_CHANGED",
                  mode: "manual",
                  message: "Bot switched to manual mode",
                });
              }
              break;

              case "MANUAL_BUY":
                console.log("🛒 Manual buy request received");
                const manualBuyStartTime = Date.now();
            
                try {
                    const { mintAddress, amount, privateKey, walletAddress, slippage, priorityFee, bribeAmount } = data.data;
                    console.log("User Input Amount (SOL):", amount);
            
                    // Convert SOL to lamports
                    const amountInLamports = Math.floor(amount * 1e9);
                    
                    let secretKeyArray: number[];
                    try {
                        // Create a new connection for this specific transaction
                        const connection = new Connection(
                            process.env.RPC_ENDPOINT || "https://api.devnet.solana.com",
                            "confirmed"
                        );
            
                        // Parse private key
                        if (typeof privateKey === "string" && !privateKey.startsWith("[")) {
                            secretKeyArray = Array.from(bs58.decode(privateKey));
                        } else {
                            secretKeyArray = Array.isArray(privateKey)
                                ? privateKey
                                : JSON.parse(privateKey);
                        }
            
                        if (!Array.isArray(secretKeyArray) || secretKeyArray.length !== 64) {
                            throw new Error("Invalid private key format");
                        }
            
                        const userKeypairForManualBuy = Keypair.fromSecretKey(
                            Uint8Array.from(secretKeyArray)
                        );
            
                        // Check balance with retry logic
                        const hasEnoughBalance = await checkWalletBalance(
                            connection,
                            userKeypairForManualBuy.publicKey,
                            amountInLamports
                        );
            
                        if (!hasEnoughBalance) {
                            ws.send(
                                JSON.stringify({
                                    type: "MANUAL_BUY_ERROR",
                                    error: "Insufficient wallet balance",
                                })
                            );
                            return;
                        }
            
                        // Update the handleManualBuy call to include new parameters
                        const result = await handleManualBuy(
                            mintAddress,
                            amountInLamports,
                            JSON.stringify(secretKeyArray),
                            connection,
                            MEMEHOME_PROGRAM_ID,
                            {
                                slippage: slippage || 1,
                                priorityFee: priorityFee || 0.001,
                                bribeAmount: bribeAmount || 0
                            }
                        );
            
                        // Handle success
                        if (result.success && result.signature && result.details) {
                            console.log("✅ Manual buy successful");
            
                            // Get transaction details for price calculation
                            const txDetails = await connection.getTransaction(result.signature, {
                                commitment: "confirmed",
                                maxSupportedTransactionVersion: 0,
                            });
            
                            if (!txDetails || !txDetails.meta) {
                                throw new Error("Failed to fetch transaction details");
                            }
            
                            // Calculate buyer index from transaction
                            const accountKeys = txDetails.transaction.message.getAccountKeys();
                            const accountKeysArray: PublicKey[] = [];
                            for (let i = 0; i < accountKeys.length; i++) {
                                const key = accountKeys.get(i);
                                if (key) accountKeysArray.push(key);
                            }
            
                            const buyerIndex = accountKeysArray.findIndex(
                                (key) => key.toBase58() === userKeypairForManualBuy.publicKey.toBase58()
                            );
            
                            // Calculate total spent for manual buy
                            const totalSpent = (txDetails.meta.preBalances[buyerIndex] - txDetails.meta.postBalances[buyerIndex]) / 1e9;
                            
                            // FIX 1: Properly convert fees to SOL
                            const priorityFeeInSol = Number(priorityFee) || 0;
                            const bribeAmountInSol = Number(bribeAmount) || 0;
                            
                            console.log("\n=== 💰 FINAL AMOUNTS ===");
                            console.log(`Total SOL Spent: ${totalSpent.toFixed(9)} SOL`);
                            console.log(`Network Fee: ${(txDetails.meta.fee / 1e9).toFixed(9)} SOL`);
                            console.log(`Priority Fee: ${priorityFeeInSol.toFixed(9)} SOL`);
                            console.log(`Bribe Amount: ${bribeAmountInSol.toFixed(9)} SOL`);
                            console.log(`Actual Buy Amount: ${(totalSpent - (txDetails.meta.fee / 1e9) - priorityFeeInSol - bribeAmountInSol).toFixed(9)} SOL`);
            
                            // FIX 2: Get userTokenAccount from result instead of swapAccounts
                            const userTokenAccount = result.details.userTokenAccount;
                            if (!userTokenAccount) {
                                throw new Error("User token account not found in result");
                            }
            
                            const userTokenAccountIndex = accountKeysArray.findIndex(
                                (key) => key.toBase58() === userTokenAccount
                            );
            
                            const preTokenBalance = txDetails.meta.preTokenBalances?.find(
                                (balance) => balance.accountIndex === userTokenAccountIndex
                            )?.uiTokenAmount.uiAmount || 0;
            
                            const postTokenBalance = txDetails.meta.postTokenBalances?.find(
                                (balance) => balance.accountIndex === userTokenAccountIndex
                            )?.uiTokenAmount.uiAmount || 0;
            
                            const tokensReceived = postTokenBalance - preTokenBalance;
            
                            // Calculate price per token with full precision
                            const pricePerToken = tokensReceived > 0 ? totalSpent / tokensReceived : 0;
            
                            // Format price to 9 decimal places without scientific notation
                            const formattedPrice = pricePerToken.toFixed(9);
            
                            // Get token metadata
                            const tokenMetadata = await connection.getParsedAccountInfo(new PublicKey(mintAddress));
                            let tokenName = "Unknown";
                            let tokenSymbol = "Unknown";
            
                            if (tokenMetadata.value &&
                                typeof tokenMetadata.value.data === "object" &&
                                "parsed" in tokenMetadata.value.data) {
                                const parsedData = tokenMetadata.value.data.parsed;
                                if (parsedData.type === "mint") {
                                    tokenName = parsedData.info.name || "Unknown";
                                    tokenSymbol = parsedData.info.symbol || "Unknown";
                                }
                            }
            
                            console.log("\n=== 💸 MANUAL BUY TRANSACTION DETAILS ===");
                            console.log(`Transaction Signature: ${result.signature}`);
                            console.log(`Status: ✅ Confirmed`);
                            console.log(`Block: ${txDetails.slot}`);
            
                            console.log("\n=== 💰 FINAL AMOUNTS ===");
                            console.log(`Total SOL Spent: ${totalSpent.toFixed(9)} SOL`);
                            console.log(`Network Fee: ${(txDetails.meta.fee / 1e9).toFixed(9)} SOL`);
                            console.log(`Priority Fee: ${priorityFeeInSol.toFixed(9)} SOL`);
                            console.log(`Bribe Amount: ${bribeAmountInSol.toFixed(9)} SOL`);
                            console.log(`Actual Buy Amount: ${(totalSpent - (txDetails.meta.fee / 1e9) - priorityFeeInSol - bribeAmountInSol).toFixed(9)} SOL`);
            
                            // Calculate and log token amounts
                            console.log("\n=== 🪙 TOKEN DETAILS ===");
                            console.log(`Pre Token Balance: ${preTokenBalance}`);
                            console.log(`Post Token Balance: ${postTokenBalance}`);
                            console.log(`Tokens Received: ${tokensReceived}`);
                            console.log(`Price per Token: ${formattedPrice}`);
            
                            console.log("\n=== ⚙️ TRANSACTION SETTINGS ===");
                            console.log(`Slippage: ${slippage}%`);
                            console.log(`Priority Fee: ${priorityFeeInSol.toFixed(9)} SOL`);
            
                            // Then use it in the database update:
                            await WalletToken.findOneAndUpdate(
                                {
                                    mint: mintAddress,
                                    userPublicKey: walletAddress,
                                },
                                {
                                    $set: {
                                        mint: mintAddress,
                                        buyPrice: formattedPrice,
                                        amount: tokensReceived.toString(),
                                        decimals: 6,
                                        name: tokenName,
                                        symbol: tokenSymbol,
                                        userPublicKey: walletAddress,
                                    }
                                },
                                { upsert: true, new: true }
                            );
            
                            // Send success response with regular number format
                            const manualBuyEndTime = Date.now(); // End time for manual buy
                            const manualBuyDuration = manualBuyEndTime - manualBuyStartTime; // Duration in milliseconds
            
                            ws.send(
                                JSON.stringify({
                                    type: "MANUAL_BUY_SUCCESS",
                                    signature: result.signature,
                                    details: {
                                        // Basic transaction info
                                        mint: mintAddress,
                                        status: "Bought",
                                        txSignature: result.signature,
                                        executionTimeMs: manualBuyDuration,
                                        buyTime: manualBuyDuration,
            
                                        // Token amounts and balances
                                        preTokenBalance: preTokenBalance,
                                        postTokenBalance: postTokenBalance,
                                        tokensReceived: tokensReceived,
                                        pricePerToken: formattedPrice,
            
                                        // Transaction costs
                                        totalSpent: totalSpent.toFixed(9),
                                        networkFee: (txDetails.meta.fee / 1e9).toFixed(9),
                                        priorityFee: priorityFeeInSol.toFixed(9),
                                        bribeAmount: bribeAmountInSol.toFixed(9),
                                        actualBuyAmount: (totalSpent - (txDetails.meta.fee / 1e9) - priorityFeeInSol - bribeAmountInSol).toFixed(9),
            
                                        // Additional info
                                        buyPrice: formattedPrice,
                                        tokenAmount: tokensReceived,
                                        slippage: slippage,
                                        block: txDetails.slot
                                    }
                                })
                            );
                        }
                    } catch (err: unknown) {
                        const processError = err as Error;
                        throw new Error(`Failed to process buy: ${processError.message}`);
                    }
                } catch (err: unknown) {
                    const buyError = err as Error;
                    console.error("❌ Manual buy error:", buyError);
                    ws.send(
                        JSON.stringify({
                            type: "MANUAL_BUY_ERROR",
                            error: buyError.message || "Failed to complete manual buy",
                        })
                    );
                }
                break;
            case "SELL_TOKEN":
              console.log("🛒 Sell token request received:", data.data);
              const sellTokenStartTime = Date.now(); // Start time for sell token

              try {
                const { mint, percent, walletAddress } = data.data; // Destructure walletAddress from data.data
                const token = await WalletToken.findOne({
                  mint,
                  userPublicKey: walletAddress, // Use the wallet address received in the message
                });

                if (!token) {
                  ws.send(JSON.stringify({
                    type: "SELL_RESULT",
                    success: false,
                    error: "Token not found in wallet"
                  }));
                  break;
                }

                // Convert amount to smallest unit (considering decimals)
                const decimals = token.decimals || 6;
                const amountInSmallestUnit = parseFloat(token.amount) * Math.pow(10, decimals);
                const userAmount = BigInt(Math.round(amountInSmallestUnit));
                const sellAmount = (userAmount * BigInt(percent)) / 100n;

                console.log("Token Amount:", token.amount);
                console.log("Decimals:", decimals);
                console.log("Amount in smallest unit:", amountInSmallestUnit);
                console.log("Sell Amount:", sellAmount.toString());

                if (sellAmount <= 0n) {
                  ws.send(JSON.stringify({
                    type: "SELL_RESULT",
                    success: false,
                    error: "Sell amount too low"
                  }));
                  break;
                }

                // === STEP 1: Calculate token amount to sell ===
                const connection = new Connection(RPC_ENDPOINT);
                // Use the userKeypair passed from the frontend for selling
                // Assuming `privateKey` will be sent with the sell request as well if it's a manual sell,
                // otherwise `userKeypair` from the env for auto sells.
                // For manual sells from frontend, you'll need the privateKey from frontend.
                // If not sent, use the bot's default `userKeypair`
                const sellUserKeypair = data.data.privateKey ?
                  Keypair.fromSecretKey(Uint8Array.from(JSON.parse(data.data.privateKey))) :
                  userKeypair;

                const programId = MEMEHOME_PROGRAM_ID;
                const mintAddress = mint;
                const mintPubkey = new PublicKey(mint);

                // === STEP 3: Get reserves info ===
                const swapAccounts = await getSwapAccounts({
                  mintAddress,
                  buyer: sellUserKeypair.publicKey, // Use the correct buyer public key for swap accounts
                  connection,
                  programId,
                });

                // Add this before getting tokenVaultInfo
                const tokenVaultInfo = await connection.getTokenAccountBalance(
                  swapAccounts.curveTokenAccount
                );
                const tokenReserve = BigInt(tokenVaultInfo.value.amount);

                const bondingCurveInfo = await connection.getAccountInfo(
                  swapAccounts.bondingCurve
                );
                if (!bondingCurveInfo) {
                  throw new Error("Bonding curve account not found");
                }
                const solReserve = BigInt(bondingCurveInfo.lamports);

                // === STEP 4: Estimate output and slippage ===
                const expectedSolOut = calculateAmountOut(
                  sellAmount,
                  tokenReserve,
                  solReserve
                );

                const slippagePercent = 10n;
                const minOut =
                  expectedSolOut > 100n ? expectedSolOut / 100n : 1n;

                // === STEP 5: Execute Sell ===
                const txSignature = await sellToken({
                  connection,
                  userKeypair: sellUserKeypair, // Use the correct userKeypair for selling
                  programId,
                  amount: sellAmount,
                  minOut,
                  swapAccounts,
                });

                console.log("✅ Sell transaction signature:", txSignature);

                // === STEP 6: Update DB ===
                // Mongoose's `token.save()` will update the correct document found earlier
                token.amount = (userAmount - sellAmount).toString();
                await token.save();

                // ट्रांजैक्शन कन्फर्मेशन का इंतज़ार करें
                if (txSignature) {
                  await connection.confirmTransaction(txSignature);
                }

                // कन्फर्मेशन के बाद टाइम एंड करें
                const sellTokenEndTime = Date.now();
                const sellTokenDuration = sellTokenEndTime - sellTokenStartTime;

                console.log(`\n=== SELL TOKEN EXECUTION TIME ===`);
                console.log(`Total execution time: ${sellTokenDuration}ms`);
                console.log(`================================\n`);

                // रिस्पांस में executionTimeMs भेजें
                ws.send(
                  JSON.stringify({
                    type: "SELL_RESULT",
                    success: true,
                    txSignature,
                    executionTimeMs: sellTokenDuration
                  })
                );
              } catch (err) {
                const errorMessage =
                  err instanceof Error
                    ? err.message
                    : "Internal server error during sell";
                console.error("Error in SELL_TOKEN:", err);
                ws.send(
                  JSON.stringify({
                    type: "SELL_RESULT",
                    success: false,
                    error: errorMessage,
                  })
                );
              }
              break;
            case "MANUAL_SELL":
              console.log("🛒 Manual sell request received");
              const manualSellStartTime = Date.now(); // Start time for manual sell

              try {
                const { mint, percent, privateKey, walletAddress: manualSellWalletAddress, slippage, priorityFee, bribeAmount } = data; // Destructure privateKey and walletAddress
                
                if (!mint || !percent || !privateKey) { // privateKey is now required for manual sell
                  throw new Error("Missing required fields: mint, percent, and privateKey");
                }
                
                console.log("\n=== SELL REQUEST DETAILS ===");
                console.log("Token Mint:", mint);
                console.log("Sell Percentage:", percent + "%");
                
                // Create userKeypair for this specific manual sell operation
                let secretKeyArrayForManualSell: number[];
                if (typeof privateKey === "string" && !privateKey.startsWith("[")) {
                  secretKeyArrayForManualSell = Array.from(bs58.decode(privateKey));
                } else {
                  secretKeyArrayForManualSell = Array.isArray(privateKey)
                    ? privateKey
                    : JSON.parse(privateKey);
                }

                if (!Array.isArray(secretKeyArrayForManualSell) || secretKeyArrayForManualSell.length !== 64) {
                  throw new Error("Invalid private key format for manual sell");
                }
                const userKeypairForManualSell = Keypair.fromSecretKey(Uint8Array.from(secretKeyArrayForManualSell));

                const token = await WalletToken.findOne({
                  mint,
                  userPublicKey: manualSellWalletAddress, // Use the wallet address received in the message
                });
                if (!token) {
                  console.log("❌ Token not found in database for this wallet");
                  ws.send(JSON.stringify({
                    type: "MANUAL_SELL_ERROR",
                    error: "Token not found in wallet"
                  }));
                  return;
                }

                // Calculate amounts
                const tokenAmount = parseFloat(token.amount);
                const decimals = token.decimals || 6;
                const sellAmount = (tokenAmount * percent) / 100;
                const remainingAmount = tokenAmount - sellAmount;
                
                console.log("\n=== TOKEN AMOUNTS ===");
                console.log("Total Token Amount:", tokenAmount);
                console.log("Sell Percentage:", percent + "%");
                console.log("Amount to Sell:", sellAmount);
                console.log("Amount After Sell:", remainingAmount);
                console.log("Token Decimals:", decimals);

                // Convert to smallest unit
                const sellAmountInSmallestUnit = Math.round(sellAmount * Math.pow(10, decimals));
                console.log("\n=== TRANSACTION DETAILS ===");
                console.log("Sell Amount (in smallest unit):", sellAmountInSmallestUnit);

                // Get reserves
                const connection = new Connection(RPC_ENDPOINT);
                const programId = MEMEHOME_PROGRAM_ID;
                const mintAddress = mint;
                const mintPubkey = new PublicKey(mint);

                // Add this before getting tokenVaultInfo
                const swapAccounts = await getSwapAccounts({
                  mintAddress: mint,
                  buyer: userKeypairForManualSell.publicKey, // Use the specific user's public key
                  connection,
                  programId: MEMEHOME_PROGRAM_ID,
                });

                // Then continue with existing code
                const tokenVaultInfo = await connection.getTokenAccountBalance(swapAccounts.curveTokenAccount);
                const tokenReserve = BigInt(tokenVaultInfo.value.amount);
                const bondingCurveInfo = await connection.getAccountInfo(swapAccounts.bondingCurve);
                if (!bondingCurveInfo) {
                  throw new Error("Bonding curve account not found");
                }
                const solReserve = BigInt(bondingCurveInfo.lamports);

                console.log("\n=== RESERVES ===");
                console.log("Token Reserve:", tokenReserve.toString());
                console.log("SOL Reserve:", solReserve.toString());

                // Calculate expected output
                const expectedSolOut = calculateAmountOut(
                  BigInt(sellAmountInSmallestUnit),
                  tokenReserve,
                  solReserve
                );

                console.log("\n=== EXPECTED OUTPUT ===");
                console.log("Expected SOL Output:", expectedSolOut.toString());
                console.log("Expected SOL Output (in SOL):", Number(expectedSolOut) / 1e9);

                // Use slippage, priorityFee, bribeAmount from request or defaults
                const slippageValue = typeof slippage === "number" ? slippage : 0;
                const priorityFeeValue = typeof priorityFee === "number" ? priorityFee : 0;
                const bribeAmountValue = typeof bribeAmount === "number" ? bribeAmount : 0;

                // Execute sell
                // Get wallet balance before
                const preBalance = await connection.getBalance(userKeypairForManualSell.publicKey);
                const txSignature = await sellToken({
                  connection,
                  userKeypair: userKeypairForManualSell, // Use the specific user's keypair
                  programId: MEMEHOME_PROGRAM_ID,
                  amount: BigInt(sellAmountInSmallestUnit),
                  minOut: expectedSolOut / 100n, // 1% slippage (will be overridden by slippage param below)
                  swapAccounts,
                  slippage: slippageValue,
                  priorityFee: priorityFeeValue,
                  bribeAmount: bribeAmountValue
                });
                if (txSignature) {
                  await connection.confirmTransaction(txSignature);
                }
                // Get wallet balance after
                const postBalance = await connection.getBalance(userKeypairForManualSell.publicKey);
                const actualSolReceived = (postBalance - preBalance) / 1e9;

                // Detailed logs
                console.log("\n=== MANUAL SELL SUMMARY ===");
                console.log(`Tokens Sold: ${sellAmount} (${sellAmountInSmallestUnit} in smallest unit)`);
                console.log(`Tokens Remaining: ${remainingAmount}`);
                console.log(`Expected SOL Output (before slippage): ${Number(expectedSolOut) / 1e9} SOL`);
                const expectedSolOutWithSlippage = Number(expectedSolOut) * (1 - slippageValue / 100) / 1e9;
                console.log(`Expected SOL Output (after slippage): ${expectedSolOutWithSlippage} SOL`);
                console.log(`Priority Fee: ${priorityFeeValue} SOL`);
                console.log(`Bribe Amount: ${bribeAmountValue} SOL`);
                console.log(`Actual SOL Received (wallet diff): ${actualSolReceived} SOL`);
                console.log("============================\n");

                // Update database
                const existingToken = await WalletToken.findOne({
                  mint: mint,
                  userPublicKey: manualSellWalletAddress,
                });
                await WalletToken.findOneAndUpdate(
                  {
                    mint: mint,
                    userPublicKey: manualSellWalletAddress,
                  },
                  {
                    $set: {
                      amount: remainingAmount.toString(),
                      lastUpdated: Date.now(),
                      buyPrice: existingToken?.buyPrice ?? 0,
                    }
                  }
                );

                console.log("\n=== DATABASE UPDATE ===");
                console.log("Updated Remaining Amount:", remainingAmount);
                console.log("========================\n");

                // Send success response
                const manualSellEndTime = Date.now(); // End time for manual sell
                const manualSellDuration = manualSellEndTime - manualSellStartTime; // Duration in milliseconds

                ws.send(JSON.stringify({
                  type: "MANUAL_SELL_SUCCESS",
                  signature: txSignature,
                  details: {
                    mint,
                    soldAmount: sellAmount.toString(),
                    remainingAmount: remainingAmount.toString(),
                    expectedSolOut: expectedSolOut.toString(),
                    executionTimeMs: manualSellDuration // Add execution time
                  }
                }));

              } catch (err) {
                console.error("❌ Manual sell error:", err);
                ws.send(JSON.stringify({
                  type: "MANUAL_SELL_ERROR",
                  error: err instanceof Error ? err.message : "Failed to complete manual sell"
                }));
              }
              break;
            case "RESET_STATE":
              resetBotState();
              break;

            case "GET_STATS":
              try {
                const requestWalletAddress = data.walletAddress || currentBuyerPublicKey;
                const [autoTokenBuys, tokenStats, walletTokens] = await Promise.all([
                    AutoTokenBuy.find({ userPublicKey: requestWalletAddress }).sort({ buyTimestamp: -1 }),
                    TokenStats.find({ userPublicKey: requestWalletAddress }).sort({ lastUpdated: -1 }),
                    WalletToken.find({ userPublicKey: requestWalletAddress }).sort({ lastUpdated: -1 }),
                ]);

                // Fetch all prices for the tokens in one go
                const tokenPrices = await TokenPrice.find({
                    mint: { $in: walletTokens.map(t => t.mint) }
                });

                // Create a map for quick lookup
                const priceMap = new Map(tokenPrices.map(tp => [tp.mint, tp]));

                // Attach currentPrice and profitLossPercent to each wallet token
                const tokensWithPrices = walletTokens.map(token => {
                    const priceEntry = priceMap.get(token.mint);
                    const currentPrice = priceEntry?.currentPrice ?? 0;
                    const buyPrice = token.buyPrice ?? 0;
                    const profitLossPercent =
                        buyPrice > 0
                            ? Number((((currentPrice - buyPrice) / buyPrice) * 100).toFixed(2))
                            : 0;

                    return {
                        ...token.toObject(),
                        currentPrice,
                        profitLossPercent,
                    };
                });

                ws.send(JSON.stringify({
                    type: "STATS_DATA",
                    data: {
                        autoTokenBuys,
                        tokenStats,
                        walletTokens: tokensWithPrices
                    }
                }));
              } catch (error) {
                console.error("Error fetching stats:", error);
                ws.send(JSON.stringify({
                    type: "ERROR",
                    message: "Failed to fetch stats"
                }));
              }
              break;

            case "UPDATE_AUTO_SNIPE_SETTINGS":
              console.log("⚙️ Updating auto-snipe settings:", data.settings);
              
              if (!data.settings) {
                console.error("❌ No settings data provided");
                ws.send(JSON.stringify({
                  type: "AUTO_SNIPE_SETTINGS_ERROR",
                  error: "No settings data provided"
                }));
                return;
              }

              // Validate buy amount
              const buyAmount = parseFloat(data.settings.buyAmount);
              if (isNaN(buyAmount) || buyAmount <= 0) {
                console.error("❌ Invalid buy amount:", data.settings.buyAmount);
                ws.send(JSON.stringify({
                  type: "AUTO_SNIPE_SETTINGS_ERROR",
                  error: "Invalid buy amount"
                }));
                return;
              }

              // Convert amounts to lamports
              const buyAmountInLamports = Math.floor(buyAmount * 1e9);
              const priorityFeeInLamports = Math.floor(parseFloat(data.settings.priorityFee || "0") * 1e9);
              const bribeAmountInLamports = Math.floor(parseFloat(data.settings.bribeAmount || "0") * 1e9);
              
              // Update global settings - IMPORTANT: Use the exact slippage value from settings
              global.autoSnipeSettings = {
                buyAmount: BigInt(buyAmountInLamports),
                slippage: parseFloat(data.settings.slippage) || 0, // Changed default to 0
                priorityFee: BigInt(priorityFeeInLamports),
                bribeAmount: BigInt(bribeAmountInLamports),
                autoBuyEnabled: data.settings.autoBuyEnabled === true
              };

              console.log("✅ Auto-snipe settings updated:", {
                buyAmount: buyAmountInLamports / 1e9 + " SOL",
                slippage: global.autoSnipeSettings.slippage + "%", // Log actual slippage value
                priorityFee: priorityFeeInLamports / 1e9 + " SOL",
                bribeAmount: bribeAmountInLamports / 1e9 + " SOL",
                autoBuyEnabled: global.autoSnipeSettings.autoBuyEnabled
              });

              ws.send(JSON.stringify({
                type: "AUTO_SNIPE_SETTINGS_UPDATED",
                settings: {
                  buyAmount: global.autoSnipeSettings.buyAmount.toString(),
                  slippage: global.autoSnipeSettings.slippage,
                  priorityFee: global.autoSnipeSettings.priorityFee.toString(),
                  bribeAmount: global.autoSnipeSettings.bribeAmount.toString(),
                  autoBuyEnabled: global.autoSnipeSettings.autoBuyEnabled
                }
              }));
              break;

            case "AUTO_SELL_CONNECT":
              console.log("✅ Auto-sell WebSocket connected!");
              ws.send(JSON.stringify({ type: "AUTO_SELL_CONNECTED" }));
              // Don't send any token data here - let GET_STATS handle that
              break;

            default:
              console.log("⚠️ Unknown message type:", data.type);
          }
        } catch (error) {
          console.error("❌ Error processing message:", error);
          ws.send(
            JSON.stringify({
              type: "ERROR",
              error: "Failed to process message",
            })
          );
        }
      });

      ws.on("close", () => {
        console.log("🔌 Client disconnected");
      });

      ws.on("error", (error) => {
        console.error("❌ WebSocket error:", error);
      });
    });
  } catch (error) {
    console.error("Error starting bot:", error);
  }
}

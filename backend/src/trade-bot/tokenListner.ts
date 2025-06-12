// Add this declaration before your imports
declare global {
  var trackedTokens: TokenData[];
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

export async function startTokenListener() {
  const connection = getConnection();
  console.log("🚀 Bot initialized - Waiting for mode selection...");

  const startListening = () => {
    // Check if a listener is ALREADY active or being set up
    if (isListening || logListener !== null) {
      console.log("👂 Already listening for tokens or listener is active.");
      return;
    }

    console.log("👂 Starting token listener...");
    // Store the listener ID returned by onLogs
    logListener = connection.onLogs(
      MEMEHOME_PROGRAM_ID,
      async (logInfo) => {
        // Only process if in auto mode
        if (!botState.isAutoMode) {
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

          const accountKeys = tx.transaction.message.staticAccountKeys;

          // Collect all relevant addresses
          const tokenData: TokenData = {
            mint: accountKeys[1].toBase58(),
            creator: accountKeys[0].toBase58(),
            bondingCurve: accountKeys[3].toBase58(), // Bonding curve PDA
            curveTokenAccount: accountKeys[2].toBase58(), // Curve token account
            userTokenAccount: accountKeys[4].toBase58(), // Your token account
            metadata: accountKeys[9].toBase58(), // Metadata account
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
            accountKeys.map((key) => key.toBase58())
          );

          const owner = accountKeys[0].toBase58();
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

          // Fetch swap accounts needed for your buy instruction
          const swapAccounts = await getSwapAccounts({
            mintAddress,
            buyer,
            connection,
            programId: MEMEHOME_PROGRAM_ID,
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
              const confirmation = await connection.confirmTransaction(
                signature,
                "confirmed"
              );

              if (confirmation.value.err) {
                throw new Error(
                  `Transaction failed: ${confirmation.value.err.toString()}`
                );
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
            console.log(
              `💸 Attempting to buy token ${mintAddress} with amount: ${BUY_AMOUNT_ADJUSTED / 1e9
              } SOL`
            );
            const autoBuyStartTime = Date.now(); // Start time for auto buy
            const signature = await buyToken({
              connection,
              userKeypair,
              programId: MEMEHOME_PROGRAM_ID,
              amount: BUY_AMOUNT_ADJUSTED,
              minOut: MIN_OUT_AMOUNT,
              direction: DIRECTION,
              swapAccounts,
            });

            if (!signature) {
              console.error(
                "❌ Buy transaction failed - no signature returned"
              );
              return;
            }

            console.log(`📝 Buy transaction signature: ${signature}`);

            // Create the confirmation strategy object
            const confirmationStrategy: TransactionConfirmationStrategy = {
              signature,
              blockhash: (await connection.getLatestBlockhash()).blockhash,
              lastValidBlockHeight: (await connection.getLatestBlockhash())
                .lastValidBlockHeight,
            };

            // Wait for confirmation with proper error handling
            const confirmation = await connection.confirmTransaction(
              confirmationStrategy
            );

            const txDetails = await connection.getTransaction(signature, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            });

            // if (confirmation.value.err) {
            //   throw new Error(
            //     `Buy transaction failed: ${confirmation.value.err.toString()}`
            //   );
            // }

            if (!txDetails || !txDetails.meta) {
              throw new Error(
                "Failed to fetch transaction details or metadata"
              );
            }

            const accountKeys = txDetails.transaction.message.getAccountKeys();
            const accountKeysArray: PublicKey[] = [];
            for (let i = 0; i < accountKeys.length; i++) {
              const key = accountKeys.get(i);
              if (key) accountKeysArray.push(key);
            }

            const buyerIndex = accountKeysArray.findIndex(
              (key) => key?.toBase58() === buyer.toBase58()
            );

            const solSpentLamports =
              txDetails.meta.preBalances[buyerIndex] -
              txDetails.meta.postBalances[buyerIndex];
            const solSpent = solSpentLamports / 1e9;

            // After getting transaction details
            console.log("🔍 Debug Info:");
            console.log("Mint Address:", mintAddress);
            console.log("User Token Account:", swapAccounts.userTokenAccount.toBase58());
            console.log("All Account Keys:", accountKeysArray.map(key => key.toBase58()));

            // Use the correct token account address from swapAccounts
            const tokenAccount = swapAccounts.userTokenAccount.toBase58();
            const tokenAccountIndex = accountKeysArray.findIndex(
              (key) => key.toBase58() === tokenAccount
            );

            console.log("Token Account Index:", tokenAccountIndex);
            console.log("Pre Token Balances:", txDetails.meta.preTokenBalances);
            console.log("Post Token Balances:", txDetails.meta.postTokenBalances);

            const preTokenBalance = txDetails.meta.preTokenBalances?.find(
              (b) => b.accountIndex === tokenAccountIndex
            )?.uiTokenAmount.uiAmount || 0;
            const postTokenBalance = txDetails.meta.postTokenBalances?.find(
              (b) => b.accountIndex === tokenAccountIndex
            )?.uiTokenAmount.uiAmount || 0;

            console.log("Pre Token Balance:", preTokenBalance);
            console.log("Post Token Balance:", postTokenBalance);

            // Calculate tokens received (exactly like manual buy)
            const tokensReceived = postTokenBalance - preTokenBalance;

            // Calculate price per token using user input SOL
            const pricePerToken = BUY_AMOUNT_SOL / tokensReceived;
            console.log("SOL SPENT:", BUY_AMOUNT_SOL);
            console.log("TOKENS RECEIVED:", tokensReceived);
            console.log("PRICE PER TOKEN:", pricePerToken, "SOL");
            // Convert to regular number with 10 decimal places
            const formattedPrice = pricePerToken.toFixed(10);

            console.log("\n=== TOKEN RECEIPT DETAILS ===");
            console.log("User Input (SOL):", BUY_AMOUNT_SOL);
            console.log("Pre Token Balance:", preTokenBalance);
            console.log("Post Token Balance:", postTokenBalance);
            console.log("Tokens Received:", tokensReceived);
            console.log("SOL Spent:", solSpent);
            console.log("Price per Token:", formattedPrice, "SOL");
            console.log("===========================\n");

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

            // Store in database
            try {
              interface UpdateData {
                mint: string;
                buyPrice: string;
                decimals: number;
                name: string;
                symbol: string;
                amount?: string;
                userPublicKey: string;
              }

              const updateData: UpdateData = {
                mint: mintAddress,
                buyPrice: formattedPrice,
                decimals: 6,
                name: tokenName,
                symbol: tokenSymbol,
                userPublicKey: currentBuyerPublicKey,
              };

              const existingDoc = await WalletToken.findOne({
                mint: mintAddress,
                userPublicKey: currentBuyerPublicKey,
              });
              if (!existingDoc) {
                updateData.amount = tokensReceived.toString();
              }

              await WalletToken.findOneAndUpdate(
                {
                  mint: mintAddress,
                  userPublicKey: currentBuyerPublicKey,
                },
                { $set: updateData },
                { upsert: true, new: true }
              );

              console.log(`✅ Token data updated in database for ${mintAddress}`);
            } catch (error) {
              console.error('❌ Error updating token data:', error);
            }

            // Add this after successful buy confirmation
            try {
              console.log("✅ Buy transaction confirmed!");

              // Only update the newly bought token
              // await updateWalletToken(connection, tokenData.mint);
              // console.log("✅ New token data updated");

              // Store buy in AutoTokenBuy collection
              await AutoTokenBuy.create({
                mint: tokenData.mint,
                creator: tokenData.creator,
                bondingCurve: tokenData.bondingCurve,
                curveTokenAccount: tokenData.curveTokenAccount,
                userTokenAccount: tokenData.userTokenAccount,
                metadata: tokenData.metadata,
                decimals: tokenData.decimals,
                supply: tokenData.supply,
                buyTimestamp: Date.now(),
                transactionSignature: signature,
                status: "bought",
                userPublicKey: currentBuyerPublicKey,
              });

              await WalletToken.findOneAndUpdate(
                {
                  mint: tokenData.mint,
                  userPublicKey: currentBuyerPublicKey,
                },
                {
                  $set: {
                    mint: tokenData.mint,
                    buyPrice: formattedPrice,
                    amount: tokensReceived.toString(),
                    decimals: 6,
                    name: tokenName,
                    symbol: tokenSymbol,
                    userPublicKey: currentBuyerPublicKey,
                  },
                },
                { upsert: true, new: true }
              );

              // Get transaction details
              const txDetails = await connection.getTransaction(signature, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0,
              });

              if (!txDetails) {
                throw new Error("Failed to fetch transaction details");
              }

              console.log(`✨ Transaction successful!`);
              console.log(`📊 Transaction details:
                Signature: ${signature}
                Block: ${txDetails.slot}
                Fee: ${txDetails.meta?.fee} lamports
              `);

              // Only add to processed set after successful buy
              if (mintAddress) {
                processedMints.add(mintAddress);
                console.log(`✅ Successfully processed mint: ${mintAddress}`);
              }

              const autoBuyEndTime = Date.now(); // End time for auto buy
              const autoBuyDuration = autoBuyEndTime - autoBuyStartTime; // Duration in milliseconds

              // Broadcast successful buy
              broadcastUpdate({
                type: "BUY_SUCCESS",
                tokenData: {
                  mint: mintAddress,
                  transactionSignature: signature,
                  stats: {
                    mint: mintAddress,
                    buyPrice: BUY_AMOUNT / 1e9,
                    currentPrice: BUY_AMOUNT / 1e9,
                    profitLoss: 0,
                    profitPercentage: 0,
                    holdingTime: "0m",
                    status: "holding"
                  },
                  executionTimeMs: autoBuyDuration // Add execution time
                }
              });

              console.log(`\n=== AUTO BUY EXECUTION TIME ===`);
              console.log(`Total execution time: ${autoBuyDuration}ms`);
              console.log(`===============================\n`);
            } catch (error) {
              console.error("❌ Error updating token data:", error);
            }
          } catch (error) {
            console.error("❌ Buy transaction failed:", error);
            if (error instanceof Error) {
              // Enhanced error logging
              console.error("Error details:", {
                message: error.message,
                stack: error.stack,
                // Cast error to SolanaError type to access additional properties
                logs: (error as SolanaError).logs || [],
                code: (error as SolanaError).code,
                details: (error as SolanaError).details || {},
              });
            }
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
              const manualBuyStartTime = Date.now(); // Start time for manual buy

              try {
                // Destructure walletAddress from data.data as well
                const { mintAddress, amount, privateKey, walletAddress: manualBuyWalletAddress } = data.data; // Added walletAddress here
                console.log("User Input Amount (SOL):", amount);

                // Convert SOL to lamports and adjust amount
                const amountInLamports = Math.floor(amount * 1e9);
                const adjustedAmount = Math.floor(amountInLamports / 1000);
                console.log("Amount in Lamports:", amountInLamports);
                console.log("Adjusted Amount:", adjustedAmount);

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

                  const userKeypairForManualBuy = Keypair.fromSecretKey( // Renamed for clarity
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

                  // Proceed with buy
                  const result = await handleManualBuy(
                    mintAddress,
                    adjustedAmount,
                    JSON.stringify(secretKeyArray),
                    connection,
                    MEMEHOME_PROGRAM_ID
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

                    // Calculate SOL spent
                    const accountKeys = txDetails.transaction.message.getAccountKeys();
                    const accountKeysArray: PublicKey[] = [];
                    for (let i = 0; i < accountKeys.length; i++) {
                      const key = accountKeys.get(i);
                      if (key) accountKeysArray.push(key);
                    }

                    const buyerIndex = accountKeysArray.findIndex(
                      (key) => key.toBase58() === userKeypairForManualBuy.publicKey.toBase58() // Use new keypair
                    );
                    const solSpentLamports = txDetails.meta.preBalances[buyerIndex] - txDetails.meta.postBalances[buyerIndex];
                    const solSpent = solSpentLamports / 1e9;

                    // Get swap accounts for token account info
                    const swapAccounts = await getSwapAccounts({
                      mintAddress,
                      buyer: userKeypairForManualBuy.publicKey, // Use new keypair
                      connection,
                      programId: MEMEHOME_PROGRAM_ID,
                    });

                    // Get the user's token account
                    const userTokenAccount = swapAccounts.userTokenAccount;
                    console.log("User Token Account:", userTokenAccount.toBase58());

                    // Find user's token account index
                    const userTokenAccountIndex = accountKeysArray.findIndex(
                      (key) => key.toBase58() === userTokenAccount.toBase58()
                    );

                    // Get pre and post token balances
                    const preTokenBalance = txDetails.meta.preTokenBalances?.find(
                      (balance) => balance.accountIndex === userTokenAccountIndex
                    )?.uiTokenAmount.uiAmount || 0;

                    const postTokenBalance = txDetails.meta.postTokenBalances?.find(
                      (balance) => balance.accountIndex === userTokenAccountIndex
                    )?.uiTokenAmount.uiAmount || 0;

                    // Calculate tokens received
                    const tokensReceived = postTokenBalance - preTokenBalance;

                    // Calculate price per token using user input SOL
                    const pricePerToken = amount / tokensReceived; // amount is user input SOL
                    console.log("SOL SPENT:", amount);
                    console.log("TOKENS RECEIVED:", tokensReceived);
                    console.log("PRICE PER TOKEN:", pricePerToken, "SOL");
                    // Convert to regular number with 10 decimal places
                    const formattedPrice = pricePerToken.toFixed(10);

                    console.log("\n=== TOKEN RECEIPT DETAILS ===");
                    console.log("User Input (SOL):", amount);
                    console.log("Pre Token Balance:", preTokenBalance);
                    console.log("Post Token Balance:", postTokenBalance);
                    console.log("Tokens Received:", tokensReceived);
                    console.log("SOL Spent:", solSpent);
                    console.log("Price per Token:", formattedPrice, "SOL"); // Will show as 0.0000000281
                    console.log("===========================\n");

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

                    // Store in database with token metadata - MANUAL BUY SECTION
                    await WalletToken.findOneAndUpdate(
                      {
                        mint: mintAddress,
                        userPublicKey: manualBuyWalletAddress, // Use the wallet address received in the message
                      },
                      {
                        $set: {
                          mint: mintAddress,
                          buyPrice: formattedPrice,
                          amount: tokensReceived.toString(),
                          decimals: 6,
                          name: tokenName,
                          symbol: tokenSymbol,
                          userPublicKey: manualBuyWalletAddress, // Ensure userPublicKey is set here too
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
                          ...result.details,
                          buyPrice: formattedPrice,
                          tokenAmount: tokensReceived,
                          executionTimeMs: manualBuyDuration // Add execution time
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
                if (!txSignature) {
                  throw new Error("Transaction signature is undefined");
                }

                const confirmation = await connection.confirmTransaction(txSignature);

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
                const { mint, percent, privateKey, walletAddress: manualSellWalletAddress } = data; // Destructure privateKey and walletAddress
                
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

                // Execute sell
                const txSignature = await sellToken({
                  connection,
                  userKeypair: userKeypairForManualSell, // Use the specific user's keypair
                  programId: MEMEHOME_PROGRAM_ID,
                  amount: BigInt(sellAmountInSmallestUnit),
                  minOut: expectedSolOut / 100n, // 1% slippage
                  swapAccounts,
                });

                console.log("\n=== TRANSACTION RESULT ===");
                console.log("Transaction Signature:", txSignature);

                // Update database
                await WalletToken.findOneAndUpdate(
                  {
                    mint: mint,
                    userPublicKey: manualSellWalletAddress, // Use the wallet address received in the message
                  },
                  {
                    $set: {
                      amount: remainingAmount.toString(),
                      lastUpdated: Date.now()
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
                // If walletAddress is sent with GET_STATS, use it to filter.
                // Otherwise, fall back to currentBuyerPublicKey from env.
                const requestWalletAddress = data.walletAddress || currentBuyerPublicKey;

                const [autoTokenBuys, tokenStats, walletTokens] =
                  await Promise.all([
                    AutoTokenBuy.find({ userPublicKey: requestWalletAddress }).sort({ buyTimestamp: -1 }),
                    TokenStats.find({ userPublicKey: requestWalletAddress }).sort({ lastUpdated: -1 }),
                    WalletToken.find({ userPublicKey: requestWalletAddress }).sort({ lastUpdated: -1 }),
                  ]);

                ws.send(
                  JSON.stringify({
                    type: "STATS_DATA",
                    data: {
                      autoTokenBuys,
                      tokenStats,
                      walletTokens,
                    },
                  })
                );
              } catch (error) {
                console.error("Error fetching stats:", error);
                ws.send(
                  JSON.stringify({
                    type: "ERROR",
                    error: "Failed to fetch statistics",
                  })
                );
              }
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

// Add these interfaces at the top with your other interfaces
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

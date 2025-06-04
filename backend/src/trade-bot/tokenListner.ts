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
import { AutoTokenBuy } from "../models/AutoTokenBuy"; // Add at the top
import { TokenStats } from "../models/TokenStats"; // Add at the top
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
let logListener: any = null;
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
        `❌ Insufficient balance. Need ${
          requiredWithBuffer / 1e9
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

async function updateWalletTokens(
  connection: Connection,
  walletPublicKey: PublicKey
) {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    for (const account of tokenAccounts.value) {
      try {
        const tokenMint = account.account.data.parsed.info.mint;
        const tokenAmount = account.account.data.parsed.info.tokenAmount.amount;
        const decimals = account.account.data.parsed.info.tokenAmount.decimals;

        // Get metadata using Metaplex
        const metaplex = new Metaplex(connection);
        const nft = await metaplex
          .nfts()
          .findByMint({ mintAddress: new PublicKey(tokenMint) });

        // Get current price
        const price = await getTokenPrice(tokenMint);

        // Update with only the required fields
        await WalletToken.findOneAndUpdate(
          { mint: tokenMint },
          {
            mint: tokenMint,
            amount: tokenAmount,
            currentPrice: price || 0,
            name: nft?.name || "Unknown",
            symbol: nft?.symbol || "Unknown",
            decimals: decimals,
            description: nft?.json?.description || "",
          },
          { upsert: true, new: true }
        );

        console.log(`✅ Updated token ${tokenMint}`);
      } catch (error) {
        console.error(`❌ Error updating token: ${error}`);
      }
    }
  } catch (error) {
    console.error("❌ Error fetching wallet tokens:", error);
  }
}

// New function to update a single wallet token
async function updateWalletToken(connection: Connection, tokenMint: string) {
  try {
    // Get token account info
    const walletPublicKey = userKeypair.publicKey;
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { mint: new PublicKey(tokenMint) }
    );

    if (tokenAccounts.value.length > 0) {
      const account = tokenAccounts.value[0];
      const tokenAmount = account.account.data.parsed.info.tokenAmount.amount;
      const decimals = account.account.data.parsed.info.tokenAmount.decimals;

      // Get metadata using Metaplex
      const metaplex = new Metaplex(connection);
      const nft = await metaplex
        .nfts()
        .findByMint({ mintAddress: new PublicKey(tokenMint) });

      // Get current price using Jupiter API
      const price = await getTokenPrice(tokenMint);

      // Update token data without description
      await WalletToken.findOneAndUpdate(
        { mint: tokenMint },
        {
          $set: {
            mint: tokenMint,
            amount: tokenAmount,
            currentPrice: price || 0,
            name: nft?.name || "Unknown",
            symbol: nft?.symbol || "Unknown",
            decimals: decimals,
          },
        },
        { upsert: true, new: true }
      );

      console.log(`✅ Updated token ${tokenMint} with price: ${price} SOL`);
    }
  } catch (error) {
    console.error(`❌ Error updating token ${tokenMint}:`, error);
  }
}

export async function startTokenListener() {
  const connection = getConnection();
  console.log("🚀 Bot initialized - Waiting for mode selection...");

  // Check if database is empty
  const existingTokens = await WalletToken.countDocuments();

  if (existingTokens === 0) {
    console.log("📝 First run detected - Initializing wallet tokens...");
    await updateWalletTokens(connection, userKeypair.publicKey);
  } else {
    console.log("✅ Existing tokens found, skipping initial update");
  }

  // Function to start listening
  const startListening = () => {
    if (isListening) {
      console.log("👂 Already listening for tokens");
      return;
    }

    console.log("👂 Starting token listener...");
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

          const buyerPublicKeyString = process.env.BUYER_PUBLIC_KEY;
          if (!buyerPublicKeyString) {
            console.error("BUYER_PUBLIC_KEY env variable is not set");
            return;
          }

          const buyer = new PublicKey(buyerPublicKeyString);

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

            if (confirmation.value.err) {
              throw new Error(
                `Buy transaction failed: ${confirmation.value.err.toString()}`
              );
            }

            // Add this after successful buy confirmation
            try {
              console.log("✅ Buy transaction confirmed!");

              // Only update the newly bought token
              await updateWalletToken(connection, tokenData.mint);
              console.log("✅ New token data updated");

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
              });

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

              // Broadcast successful buy
              broadcastUpdate({
                type: "BUY_SUCCESS",
                tokenData: {
                  mint: mintAddress,
                  stats: {
                    mint: mintAddress,
                    buyPrice: BUY_AMOUNT / 1e9, // Convert lamports to SOL
                    currentPrice: BUY_AMOUNT / 1e9,
                    profitLoss: 0,
                    profitPercentage: 0,
                    holdingTime: "0m",
                    status: "holding",
                  },
                },
              });
              await TokenStats.findOneAndUpdate(
                { mint: mintAddress },
                {
                  mint: mintAddress,
                  buyPrice: BUY_AMOUNT / 1e9,
                  currentPrice: BUY_AMOUNT / 1e9,
                  profitLoss: 0,
                  profitPercentage: 0,
                  holdingTime: "0m",
                  status: "holding",
                  lastUpdated: Date.now(),
                },
                { upsert: true, new: true }
              );
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

    if (logListener) {
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
          console.log("📨 Received message:", data);

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
              try {
                const { mintAddress, amount, privateKey } = data.data;

                // Convert SOL to lamports and adjust amount
                const amountInLamports = Math.floor(amount * 1e9);
                const adjustedAmount = Math.floor(amountInLamports / 1000);

                console.log(
                  `💰 Original amount: ${amountInLamports} lamports (${amount} SOL)`
                );
                console.log(
                  `💵 Adjusted amount: ${adjustedAmount} lamports (${
                    adjustedAmount / 1e9
                  } SOL)`
                );

                let secretKeyArray: number[];
                try {
                  // Create a new connection for this specific transaction
                  const connection = new Connection(
                    process.env.RPC_ENDPOINT || "https://api.devnet.solana.com",
                    "confirmed"
                  );

                  // Parse private key
                  if (
                    typeof privateKey === "string" &&
                    !privateKey.startsWith("[")
                  ) {
                    secretKeyArray = Array.from(bs58.decode(privateKey));
                  } else {
                    secretKeyArray = Array.isArray(privateKey)
                      ? privateKey
                      : JSON.parse(privateKey);
                  }

                  if (
                    !Array.isArray(secretKeyArray) ||
                    secretKeyArray.length !== 64
                  ) {
                    throw new Error("Invalid private key format");
                  }

                  const userKeypair = Keypair.fromSecretKey(
                    Uint8Array.from(secretKeyArray)
                  );

                  // Check balance with retry logic
                  const hasEnoughBalance = await checkWalletBalance(
                    connection,
                    userKeypair.publicKey,
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
                  if (result.success) {
                    console.log("✅ Manual buy successful");
                    await updateWalletToken(connection, mintAddress);

                    ws.send(
                      JSON.stringify({
                        type: "MANUAL_BUY_SUCCESS",
                        signature: result.signature,
                        details: result.details,
                      })
                    );
                  }
                } catch (err: unknown) {
                  const processError = err as Error;
                  throw new Error(
                    `Failed to process buy: ${processError.message}`
                  );
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
              const parsed = JSON.parse(message);
              console.log("🛒 Sell token request received:", parsed.data);

              try {
                const { mint, percent } = parsed.data; // ✅ FIXED

                const token = await WalletToken.findOne({ mint });
                if (!token) {
                  ws.send(
                    JSON.stringify({
                      type: "SELL_RESULT",
                      success: false,
                      error: "Token not found in wallet",
                    })
                  );
                  break;
                }

                // === STEP 1: Calculate token amount to sell ===
                const userAmount = BigInt(token.amount); // amount in smallest units
                const decimals = token.decimals;
                const sellAmount = (userAmount * BigInt(percent)) / 100n;

                if (sellAmount <= 0n) {
                  ws.send(
                    JSON.stringify({
                      type: "SELL_RESULT",
                      success: false,
                      error: "Sell amount too low",
                    })
                  );
                  break;
                }

                // === STEP 2: Setup Solana connection and keys ===
                const connection = new Connection(RPC_ENDPOINT);
                const userKeypair = Keypair.fromSecretKey(secretKey);
                const programId = MEMEHOME_PROGRAM_ID;
                const mintAddress = mint;
                const mintPubkey = new PublicKey(mint);

                // === STEP 3: Get reserves info ===
                const swapAccounts = await getSwapAccounts({
                  mintAddress,
                  buyer: BUYER_PUBLIC_KEY,
                  connection,
                  programId,
                });

                const tokenVaultInfo = await connection.getTokenAccountBalance(
                  swapAccounts.curveTokenAccount
                );
                const tokenReserve = BigInt(tokenVaultInfo.value.amount);

                const bondingCurveInfo = await connection.getAccountInfo(
                  swapAccounts.bondingCurve
                );
                if (!bondingCurveInfo)
                  throw new Error("bondingCurve account info missing");

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
                  userKeypair,
                  programId,
                  amount: sellAmount,
                  minOut,
                  swapAccounts,
                });

                console.log("✅ Sell transaction signature:", txSignature);

                // === STEP 6: Update DB ===
                token.amount = (userAmount - sellAmount).toString();
                await token.save();

                ws.send(
                  JSON.stringify({
                    type: "SELL_RESULT",
                    success: true,
                    txSignature,
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
              try {
                const [autoTokenBuys, tokenStats, walletTokens] =
                  await Promise.all([
                    AutoTokenBuy.find().sort({ buyTimestamp: -1 }),
                    TokenStats.find().sort({ lastUpdated: -1 }),
                    WalletToken.find().sort({ lastUpdated: -1 }),
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
            case "RESET_STATE":
              resetBotState();
              break;

            case "GET_STATS":
              try {
                const [autoTokenBuys, tokenStats, walletTokens] =
                  await Promise.all([
                    AutoTokenBuy.find().sort({ buyTimestamp: -1 }),
                    TokenStats.find().sort({ lastUpdated: -1 }),
                    WalletToken.find().sort({ lastUpdated: -1 }),
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

interface WalletToken {
  mint: string; // Token's mint address
  amount: string; // Amount of tokens held
  valueInSol: number; // Value in SOL
  buyPrice: number; // Price when bought
  lastPrice: number; // Latest price
  lastUpdated: number; // Last update timestamp
  metadata: {
    name: string; // Token name
    symbol: string; // Token symbol
    decimals: number; // Token decimals
  };
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
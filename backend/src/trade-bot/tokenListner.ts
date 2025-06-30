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
  var currentUserId: string | null;
}

import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { getConnection } from "../utils/getProvider";
import { getSwapAccounts } from "../action/getSwapAccounts";
import { buyToken } from "../action/buy";
import { handleManualBuy } from "../action/manualBuy";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  //TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import WebSocket, { WebSocketServer } from "ws";
import bs58 from "bs58";
//import { AutoTokenBuy } from "../models/AutoTokenBuy";
//import { TokenStats } from "../models/TokenStats";
import { WalletToken } from "../models/WalletToken";
import { sellToken } from "../action/sell";
import { TokenPrice } from "../models/TokenPrice";
import { getCurrentPrice } from "../helper-functions/getCurrentPrice";
import { AutoSell } from "../models/autoSell";
//import { sendFullStatsToClient } from "../helper-functions/dbStatsBroadcaster";
// import { trackBuyTransaction } from "../helper-functions/wallet-token-watcher";

// import { addOrUpdateTokenFromBuy } from "../helper-functions/wallet-token-watcher";
import {
  addOrUpdateTokenFromBuy,
  updateOrRemoveTokenAfterSell,
} from "../helper-functions/db-buy-sell-enterer";
import { RPC_ENDPOINT } from "../config/test-config";

import {
  calculateAmountOut,
  broadcastUpdate,
  checkWalletBalance,
} from "../helper-functions/runner_functions";

import {
  getUserKeypairById,
  getUserKeypairByWallet,
} from "../utils/userWallet";
import jwt from "jsonwebtoken";
import { connection } from "mongoose";

const MEMEHOME_PROGRAM_ID = new PublicKey(process.env.MEMEHOME_PROGRAM_ID!);

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

const MIN_OUT_AMOUNT = 1;
const DIRECTION = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Replace the current WebSocket server creation
let wss: WebSocketServer;

//export { wss };

// Extended WebSocket interface for user data
interface WSWithUser extends WebSocket {
  userId?: string;
  autoSnipeSettings?: {
    buyAmount: bigint;
    slippage: number;
    priorityFee: bigint;
    bribeAmount: bigint;
    autoBuyEnabled: boolean;
  };
  trackedTokens?: TokenData[];
  _autoSnipeActive?: boolean;
  _autoSnipeCleanup?: () => void;
}

const defaultAutoSnipeSettings = {
  buyAmount: BigInt(0),
  slippage: 1,
  priorityFee: BigInt(0),
  bribeAmount: BigInt(0),
  autoBuyEnabled: false,
};

// User sessions map - ye multiple users ko track karega
const userSessions = new Map<
  string,
  {
    ws: WSWithUser;
    logListener: number | null;
    isListening: boolean;
    userPublicKey: PublicKey;
  }
>();

// Create WebSocket server with retry logic
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

// Initialize WebSocket server
wss = createWebSocketServer();

// JWT verification function
const verifyToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    return decoded as { id: string; email: string };
  } catch (err) {
    console.error("❌ Token verification failed:", err);
    return null;
  }
};

// Auto snipe function - handles token detection and auto buying
const handleAutoSnipe = async (
  connection: Connection,
  userPublicKey: PublicKey,
  logInfo: any,
  userId: string
) => {
  console.log(`[DEBUG] 1. handleAutoSnipe called for user: ${userId}`);
  try {
    console.log("📝 Received logs:", logInfo.logs);

    // Check if user is logged in
    if (!userId) {
      console.log("❌ No user logged in, skipping token detection");
      return;
    }

    // Get user session
    const userSession = userSessions.get(userId);
    if (!userSession || !userSession.ws.autoSnipeSettings?.autoBuyEnabled) {
      console.log(
        "❌ [TOKEN DETECTION] Auto-buy is disabled, skipping buy attempt"
      );
      return;
    }

    console.log(
      "✅ [TOKEN DETECTION] Auto-buy is enabled, proceeding with token detection..."
    );
    console.log(
      `[DEBUG] 2. Conditions met, proceeding to get transaction for signature: ${logInfo.signature}`
    );

    const { logs, signature } = logInfo;
    let mintAddress: string | undefined;

    // More specific token creation detection
    const isCreateMint = logs.some((log: string) =>
      log.includes("Program log: Instruction: InitializeMint2")
    );

    const isLaunchInstruction = logs.some((log: string) =>
      log.includes("Program log: Instruction: Launch")
    );

    // Only proceed if both conditions are met
    if (!isCreateMint || !isLaunchInstruction) {
      return;
    }

    console.log("🎯 [TOKEN DETECTION] New token creation detected!");

    await sleep(2000);

    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx?.transaction?.message) {
      console.log("❌ Invalid transaction data");
      return;
    }
    console.log(`[DEBUG] 3. Transaction data fetched successfully.`);

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
      bondingCurve: accountKeysArray[3].toBase58(),
      curveTokenAccount: accountKeysArray[2].toBase58(),
      userTokenAccount: accountKeysArray[4].toBase58(),
      metadata: accountKeysArray[9].toBase58(),
      decimals: 9,
    };

    // Log detailed token info
    console.log("\n📋 Token Details:");
    console.log("----------------------------------------");
    console.log(`🎯 Mint Address:        ${tokenData.mint}`);
    console.log(`👤 Creator:            ${tokenData.creator}`);
    console.log("----------------------------------------\n");

    // Add to user's tracked tokens
    if (!userSession.ws.trackedTokens) {
      userSession.ws.trackedTokens = [];
    }
    userSession.ws.trackedTokens.push(tokenData);

    // Broadcast new token detection to specific user
    userSession.ws.send(
      JSON.stringify({
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
          txSignature: null,
        },
      })
    );

    const detectionPrice = await getCurrentPrice(
      connection,
      tokenData.mint,
      userPublicKey
    );

    mintAddress = tokenData.mint;

    // Skip if already processed
    if (processedMints.has(mintAddress)) {
      console.log(`⏭️ Skipping: Already processed ${mintAddress}`);
      return;
    }

    // Validate mint address
    const mintInfo = await connection.getParsedAccountInfo(
      new PublicKey(mintAddress)
    );
    let mintType: string | undefined = undefined;
    if (
      mintInfo.value &&
      typeof mintInfo.value.data === "object" &&
      "parsed" in mintInfo.value.data
    ) {
      mintType = mintInfo.value.data.parsed.type;
    }
    if (mintType !== "mint") {
      console.error(
        "❌ Skipping: accountKeys[1] is not a valid SPL Token Mint."
      );
      return;
    }

    // Get swap accounts
    console.log(`[DEBUG] 5. Getting swap accounts for mint: ${mintAddress}`);
    const swapAccounts = await getSwapAccounts({
      mintAddress,
      buyer: userPublicKey,
      connection,
      programId: MEMEHOME_PROGRAM_ID,
    });
    console.log(`[DEBUG] 6. Swap accounts fetched.`);

    // Calculate curve token ATA
    const curveTokenATA = await getAssociatedTokenAddress(
      swapAccounts.tokenMint,
      swapAccounts.bondingCurve,
      true
    );

    const ataInfo = await connection.getAccountInfo(curveTokenATA);
    if (ataInfo) {
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
        return;
      }
    } else {
      try {
        console.log("[DEBUG] 7. ATA does not exist. Attempting to create...");
        const createAtaIx = createAssociatedTokenAccountInstruction(
          userPublicKey,
          curveTokenATA,
          swapAccounts.bondingCurve,
          swapAccounts.tokenMint
        );

        const createAtaTx = new Transaction().add(createAtaIx);
        createAtaTx.feePayer = userPublicKey;
        createAtaTx.recentBlockhash = (
          await connection.getLatestBlockhash()
        ).blockhash;

        console.log(`[DEBUG] 8. Fetching keypair for user ID: ${userId}`);
        const userKeypair = await getUserKeypairById(userId);
        console.log(
          `[DEBUG] 9. Keypair fetched. Signing ATA creation transaction.`
        );
        createAtaTx.sign(userKeypair);

        const signature = await connection.sendRawTransaction(
          createAtaTx.serialize()
        );
        console.log(
          `[DEBUG] 10. ATA creation transaction sent. Signature: ${signature}`
        );

        if (signature) {
          await connection.confirmTransaction(signature);
        }
        console.log(`[DEBUG] 11. ATA creation confirmed.`);

        const newAtaInfo = await connection.getAccountInfo(curveTokenATA);
        if (!newAtaInfo) {
          throw new Error("ATA creation failed - account not found");
        }
      } catch (ataError) {
        console.error(
          "❌ [DEBUG] CRASH POINT? Failed to create ATA:",
          ataError
        );
        return;
      }
    }

    swapAccounts.curveTokenAccount = curveTokenATA;

    if (!swapAccounts.userTokenAccount || !swapAccounts.curveTokenAccount) {
      console.error("❌ Missing required token accounts");
      return;
    }

    try {
      console.log(`[DEBUG] 12. Preparing to execute buy transaction.`);
      const settings = userSession.ws.autoSnipeSettings!;
      const buyAmount = Number(settings.buyAmount);
      const priorityFee = Number(settings.priorityFee);
      const bribeAmount = Number(settings.bribeAmount);

      const totalRequired = buyAmount + priorityFee + bribeAmount + 10_000_000;

      const balance = await connection.getBalance(userPublicKey);
      if (balance < totalRequired) {
        console.error(
          `❌ Insufficient balance. Need ${totalRequired / 1e9} SOL (including fees)`
        );
        return;
      }

      console.log("\n=== 💰 TRANSACTION BREAKDOWN ===");
      console.log(`Priority Fee: ${priorityFee / 1e9} SOL`);
      console.log(`Bribe Amount: ${bribeAmount / 1e9} SOL`);
      console.log(`Network Fee Buffer: 0.01 SOL`);
      console.log(`Slippage: ${settings.slippage}%`);
      console.log("==============================\n");

      const autoBuyStartTime = Date.now();
      const buyPriceAtDetection = await getCurrentPrice(
        connection,
        mintAddress,
        userPublicKey
      );

      console.log(
        `[DEBUG] 13. Fetching keypair for buy transaction for user ID: ${userId}`
      );
      const signature = await buyToken({
        connection,
        userKeypair: await getUserKeypairById(userId),
        programId: MEMEHOME_PROGRAM_ID,
        amount: buyAmount,
        minOut: MIN_OUT_AMOUNT,
        direction: DIRECTION,
        swapAccounts,
        slippage: settings.slippage,
        priorityFee: priorityFee,
        bribeAmount: bribeAmount,
      });
      console.log(
        `[DEBUG] 14. buyToken function returned with signature: ${signature}`
      );

      if (!signature) {
        console.error("❌ Buy transaction rejected due to validation failure");
        return;
      }

      const autoBuyEndTime = Date.now();
      const txDetails = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (txDetails?.meta) {
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

        const preTokenBalance =
          txDetails.meta.preTokenBalances?.find(
            (balance) => balance.accountIndex === userTokenAccountIndex
          )?.uiTokenAmount.uiAmount || 0;

        const postTokenBalance =
          txDetails.meta.postTokenBalances?.find(
            (balance) => balance.accountIndex === userTokenAccountIndex
          )?.uiTokenAmount.uiAmount || 0;

        const tokensReceived = postTokenBalance - preTokenBalance;

        console.log("\n=== 💸 TRANSACTION DETAILS ===");
        console.log(`Transaction Signature: ${signature}`);
        console.log(`Status: ✅ Confirmed`);
        console.log(`Block: ${txDetails.slot}`);
        console.log(`Tokens Received: ${tokensReceived}`);

        const autoBuyDuration = autoBuyEndTime - autoBuyStartTime;

        userSession.ws.send(
          JSON.stringify({
            type: "AUTO_BUY_SUCCESS",
            signature: signature,
            details: {
              mint: mintAddress,
              buyPrice: buyPriceAtDetection,
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
              supply: tokenData.supply,
            },
          })
        );

        console.log(`💰 Token detection price: ${detectionPrice} SOL`);

        await addOrUpdateTokenFromBuy({
          mint: mintAddress,
          buyPrice: buyPriceAtDetection,
          amount: tokensReceived.toString(),
          userPublicKey: userPublicKey.toBase58(),
        });
      }
    } catch (error) {
      console.error("❌ [DEBUG] CRASH POINT? Buy transaction failed:", error);
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
    }
  } catch (error) {
    console.error("❌ [DEBUG] CRASH POINT? Error in handleAutoSnipe:", error);
  }
};

// Start token listener for a specific user
const startTokenListener = async (userId: string, userPublicKey: PublicKey) => {
  const connection = getConnection();
  const userSession = userSessions.get(userId);

  if (!userSession) {
    console.error("❌ User session not found");
    return;
  }

  if (userSession.isListening) {
    console.log("✅ Already listening for user:", userId);
    return;
  }

  console.log(`🔑 Starting token listener for user: ${userId}`);

  // Set up log listener
  userSession.logListener = connection.onLogs(
    MEMEHOME_PROGRAM_ID,
    async (logInfo) => {
      await handleAutoSnipe(connection, userPublicKey, logInfo, userId);
    },
    "confirmed"
  );

  userSession.isListening = true;
  console.log(`✅ Token listener started for user: ${userId}`);
};

// Stop token listener for a specific user
const stopTokenListener = (userId: string) => {
  const userSession = userSessions.get(userId);

  if (!userSession) {
    return;
  }

  if (userSession.logListener) {
    const connection = getConnection();
    connection.removeOnLogsListener(userSession.logListener);
    userSession.logListener = null;
  }

  userSession.isListening = false;
  console.log(`🛑 Token listener stopped for user: ${userId}`);
  console.log(`[TOKEN_LISTENER] STOP for userId: ${userId}`);
};

// Global WebSocket connection handler setup
wss.on("connection", (ws: WSWithUser) => {
  console.log("🔌 New client connected");
  logAllUserSessions();

  ws.on("message", async (message: string) => {
    try {
      const data = JSON.parse(message);
      console.log("📨 Received message type:", data.type);
      console.log(`[WS MESSAGE] type: ${data.type}, userId: ${ws.userId}`);

      switch (data.type) {
        case "AUTHENTICATE": {
          const authToken = data.token;
          if (!authToken) {
            ws.send(
              JSON.stringify({ type: "AUTH_ERROR", error: "No token provided" })
            );
            return;
          }
          const decoded = verifyToken(authToken);
          if (!decoded) {
            ws.send(
              JSON.stringify({ type: "AUTH_ERROR", error: "Invalid token" })
            );
            return;
          }
          ws.userId = decoded.id;
          ws.autoSnipeSettings = { ...defaultAutoSnipeSettings };
          ws.trackedTokens = [];

          // Store user session
          const userKeypair = await getUserKeypairById(decoded.id);
          userSessions.set(decoded.id, {
            ws,
            logListener: null,
            isListening: false,
            userPublicKey: userKeypair.publicKey,
          });

          ws.send(
            JSON.stringify({
              type: "AUTH_SUCCESS",
              message: "WebSocket authenticated successfully",
            })
          );
          break;
        }

        case "AUTO_SNIPE_CONNECT": {
          if (!ws.userId) {
            ws.send(
              JSON.stringify({
                type: "AUTO_SNIPE_ERROR",
                error: "User not authenticated",
              })
            );
            break;
          }

          const userSession = userSessions.get(ws.userId);
          if (!userSession) {
            ws.send(
              JSON.stringify({
                type: "AUTO_SNIPE_ERROR",
                error: "User session not found",
              })
            );
            break;
          }

          if (!ws._autoSnipeActive) {
            ws._autoSnipeActive = true;
            await startTokenListener(ws.userId, userSession.userPublicKey);
            console.log(
              `🚀 Auto-snipe listener started for user: ${userSession.userPublicKey.toBase58()}`
            );
          }

          ws.send(
            JSON.stringify({
              type: "AUTO_SNIPE_CONNECTED",
              message: "Auto-snipe activated for your wallet.",
            })
          );
          logAllUserSessions();
          break;
        }

        case "SET_MODE":
          if (data.mode === "automatic") {
            if (ws.userId) {
              const userSession = userSessions.get(ws.userId);
              if (userSession) {
                await startTokenListener(ws.userId, userSession.userPublicKey);
              }
            }
            ws.send(
              JSON.stringify({
                type: "MODE_CHANGED",
                mode: "automatic",
                message: "Bot switched to automatic mode",
              })
            );
          } else if (data.mode === "manual") {
            if (ws.userId) {
              stopTokenListener(ws.userId);
            }
            ws.send(
              JSON.stringify({
                type: "MODE_CHANGED",
                mode: "manual",
                message: "Bot switched to manual mode",
              })
            );
          }
          logAllUserSessions();
          break;

        case "UPDATE_AUTO_SNIPE_SETTINGS":
          if (!ws.userId || !ws.autoSnipeSettings) {
            ws.send(
              JSON.stringify({ type: "ERROR", error: "User not authenticated" })
            );
            break;
          }

          // Log old and new settings
          console.log(`🛠️ [AUTO_SNIPE_SETTINGS] User: ${ws.userId}`);
          console.log("    Old settings:", ws.autoSnipeSettings);
          console.log("    New settings:", data.settings);

          ws.autoSnipeSettings = {
            ...ws.autoSnipeSettings,
            ...data.settings,
          };

          // Log autoBuyEnabled specifically
          if ("autoBuyEnabled" in data.settings) {
            console.log(
              `🔘 [AUTO_BUY] User: ${ws.userId} set autoBuyEnabled = ${data.settings.autoBuyEnabled}`
            );
          }

          ws.send(
            JSON.stringify({
              type: "SETTINGS_UPDATED",
              message: "Auto-snipe settings updated successfully",
            })
          );
          break;

        case "MANUAL_BUY":
          console.log("[DEBUG] MANUAL_BUY case started.");

          // Log frontend se aayi values
          console.log("[MANUAL_BUY] Frontend values:");
          console.log("  mintAddress:", data.mintAddress);
          console.log("  amount (lamports):", data.amount, "(", data.amount / 1e9, "SOL )");
          console.log("  slippage:", data.slippage);
          console.log("  priorityFee (lamports):", data.priorityFee, "(", data.priorityFee / 1e9, "SOL )");
          console.log("  bribeAmount (lamports):", data.bribeAmount, "(", data.bribeAmount / 1e9, "SOL )");

          if (!ws.userId) {
            ws.send(JSON.stringify({ type: "ERROR", error: "User not authenticated" }));
            break;
          }
          try {
            const userKeypair = await getUserKeypairById(ws.userId);

            // Backend calculation logs
            const networkFeeBuffer = 2_000_000; // Example buffer
            const totalRequired = data.amount + (data.priorityFee || 0) + (data.bribeAmount || 0) + networkFeeBuffer;
            console.log("[MANUAL_BUY] Backend calculation:");
            console.log("  networkFeeBuffer (lamports):", networkFeeBuffer, "(", networkFeeBuffer / 1e9, "SOL )");
            console.log("  totalRequired (lamports):", totalRequired, "(", totalRequired / 1e9, "SOL )");
            

            


            //const buyAmount = getCurrentPrice(connection, data.mintAddress, userKeypair.publicKey);
            const result = await handleManualBuy(
              data.mintAddress,
              data.amount,
              userKeypair,
              getConnection(),
              MEMEHOME_PROGRAM_ID,
              {
                slippage: data.slippage || 1,
                priorityFee: data.priorityFee || 0,
                bribeAmount: data.bribeAmount || 0,
              }
            );
            console.log("[DEBUG] handleManualBuy result:", result);

            if (result && result.signature) {
              // 1. DB update karo (same as auto-buy)
              await addOrUpdateTokenFromBuy({
                mint: data.mintAddress,
                buyPrice: result.details?.price ?? 0, // Use token price, not SOL
                amount: (result.details?.amount ?? 0).toString(),  // <-- Convert to string
                userPublicKey: userKeypair.publicKey.toBase58(),
              });

              // 2. Client ko success bhejo
              ws.send(
                JSON.stringify({
                  type: "MANUAL_BUY_SUCCESS",
                  signature: result.signature,
                  details: result,
                })
              );
            } else {
              console.error("[DEBUG] Manual buy failed, result:", result); // <-- Add this line
              ws.send(
                JSON.stringify({
                  type: "MANUAL_BUY_ERROR",
                  error: "Buy transaction failed or no signature returned",
                })
              );
            }
          } catch (error) {
            console.error("[DEBUG] Manual buy error:", error); // <-- Add this line
            ws.send(
              JSON.stringify({
                type: "MANUAL_BUY_ERROR",
                error: error instanceof Error ? error.message : "Unknown error",
              })
            );
          }
          break;

        case "MANUAL_SELL":
          // Handle manual sell
          if (!ws.userId) {
            ws.send(
              JSON.stringify({ type: "ERROR", error: "User not authenticated" })
            );
            break;
          }

          try {
            const userSession = userSessions.get(ws.userId);
            if (!userSession) {
              ws.send(
                JSON.stringify({
                  type: "ERROR",
                  error: "User session not found",
                })
              );
              break;
            }

            const result = await sellToken({
              connection: getConnection(),
              userKeypair: await getUserKeypairById(ws.userId),
              programId: MEMEHOME_PROGRAM_ID,
              amount: BigInt(data.amount),
              minOut: BigInt(1),
              swapAccounts: await getSwapAccounts({
                mintAddress: data.mintAddress,
                buyer: userSession.userPublicKey,
                connection: getConnection(),
                programId: MEMEHOME_PROGRAM_ID,
              }),
              slippage: data.slippage || 1,
              priorityFee: data.priorityFee || 0,
              bribeAmount: data.bribeAmount || 0,
            });

            ws.send(
              JSON.stringify({
                type: "MANUAL_SELL_SUCCESS",
                result,
              })
            );
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "MANUAL_SELL_ERROR",
                error: error instanceof Error ? error.message : "Unknown error",
              })
            );
          }
          break;

        case "RESET_STATE":
          console.log(`[INFO] User ${ws.userId} returned to initial state`);
          ws.autoSnipeSettings = { ...defaultAutoSnipeSettings };
          ws.trackedTokens = [];
          break;

        default:
          console.log("⚠️ Unknown message type:", data.type);
          ws.send(
            JSON.stringify({
              type: "ERROR",
              error: "Unknown message type",
            })
          );
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

  ws.on("close", (code, reason) => {
    console.log("🔌 Client disconnected", code, reason?.toString());
    logAllUserSessions();

    // Clean up user session
    if (ws.userId) {
      stopTokenListener(ws.userId);
      userSessions.delete(ws.userId);
      console.log(`🛑 Cleaned up session for user: ${ws.userId}`);
    }
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
  });
});

// Initialize global settings
if (!global.autoSnipeSettings) {
  global.autoSnipeSettings = defaultAutoSnipeSettings;
}

if (!global.trackedTokens) {
  global.trackedTokens = [];
}

function logAllUserSessions() {
  console.log("=== Connected User Sessions ===");
  for (const [userId, session] of userSessions.entries()) {
    console.log(
      `UserID: ${userId}, PublicKey: ${session.userPublicKey.toBase58()}, isListening: ${session.isListening}`
    );
  }
  console.log("===============================");
}

export { wss, userSessions };

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

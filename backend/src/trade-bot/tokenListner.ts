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
  getAccount,
  //TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import WebSocket, { WebSocketServer } from "ws";
//import bs58 from "bs58";
//import { AutoTokenBuy } from "../models/AutoTokenBuy";
//import { TokenStats } from "../models/TokenStats";
//import { WalletToken } from "../models/WalletToken";
import { sellToken } from "../action/sell";
import { TokenPrice } from "../models/TokenPrice";
import { getCurrentPrice } from "../helper-functions/getCurrentPrice";
//import { AutoSell } from "../models/autoSell";
//import { sendFullStatsToClient } from "../helper-functions/dbStatsBroadcaster";
// import { trackBuyTransaction } from "../helper-functions/wallet-token-watcher";

// import { addOrUpdateTokenFromBuy } from "../helper-functions/wallet-token-watcher";
import {
  addOrUpdateTokenFromBuy,
  updateOrRemoveTokenAfterSell,
} from "../helper-functions/db-buy-sell-enterer";
//import { RPC_ENDPOINT } from "../config/test-config";

import {
  calculateAmountOut,
  //broadcastUpdate,
  //checkWalletBalance,
} from "../helper-functions/runner_functions";

import {
  getUserKeypairById,
  getUserKeypairByWallet,
} from "../utils/userWallet";
import jwt from "jsonwebtoken";
//import { connection } from "mongoose";
import { Server as HttpServer } from "http";
//import User from "../models/user_auth";
//import crypto from 'crypto';
//import { startAutoSellWorker } from '../helper-functions/autosellworker';
import UserPreset from '../models/userPreset';
import { UserToken } from "../models/userToken";

const MEMEHOME_PROGRAM_ID = new PublicKey(process.env.MEMEHOME_PROGRAM_ID!);

// At the top of file, add this Set to track processed mints
const processedMints = new Set<string>();

// Add this interface at the top of the file


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
  walletAddress?: string;
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
export const createWebSocketServer = (server: HttpServer): WebSocketServer => {
  const wss = new WebSocketServer({ server });
  console.log(`📡 WebSocket server attached to existing HTTP server`);
  return wss;
};

// JWT verification function
const verifyToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    return decoded as { id: string; email: string; walletAddress?: string };
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
  //console.log(`[DEBUG] 1. handleAutoSnipe called for user: ${userId}`);
  try {
    //console.log("📝 Received logs:", logInfo.logs);

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
      "✅ [TOKEN DETECTION] Auto-buy is enabled, proceeding with Buy Token..."
    );
    //console.log(
    //  `[DEBUG] 2. Conditions met, proceeding to get transaction for signature: ${logInfo.signature}`
    //);

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
    //console.log(`[DEBUG] 5. Getting swap accounts for mint: ${mintAddress}`);
    const swapAccounts = await getSwapAccounts({
      mintAddress,
      buyer: userPublicKey,
      connection,
      programId: MEMEHOME_PROGRAM_ID,
    });
    //console.log(`[DEBUG] 6. Swap accounts fetched.`);

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
        //console.log("[DEBUG] 7. ATA does not exist. Attempting to create...");
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

        //console.log(`[DEBUG] 8. Fetching keypair for user ID: ${userId}`);
        const userKeypair = await getUserKeypairById(userId);
        //console.log(
        //  `[DEBUG] 9. Keypair fetched. Signing ATA creation transaction.`
        //);
        createAtaTx.sign(userKeypair);

        const signature = await connection.sendRawTransaction(
          createAtaTx.serialize()
        );
        //console.log(
        //  `[DEBUG] 10. ATA creation transaction sent. Signature: ${signature}`
        //);

        if (signature) {
          await connection.confirmTransaction(signature);
        }
        //console.log(`[DEBUG] 11. ATA creation confirmed.`);

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
      //console.log(`[DEBUG] 12. Preparing to execute buy transaction.`);
      const settings = userSession.ws.autoSnipeSettings!;
      const buyAmount = Number(settings.buyAmount);

      // Get active buy preset from DB
      const userPreset = await UserPreset.findOne({ userId });
      const activePreset = (userPreset?.buyPresets?.[userPreset.activeBuyPreset] || {}) as { slippage?: number|string, priorityFee?: number|string, bribeAmount?: number|string };

      // Use preset values for fees
      const slippage = Number(activePreset.slippage) || 1;
      const priorityFee = Math.floor(Number(activePreset.priorityFee || 0) * 1_000_000_000);
      const bribeAmount = Math.floor(Number(activePreset.bribeAmount || 0) * 1_000_000_000);

      // Log for debugging
      console.log(`[AUTO SNIPE] Using preset #${userPreset?.activeBuyPreset ?? 0}:`);
      console.log(`  Slippage: ${slippage}`);
      console.log(`  Priority Fee: ${priorityFee}`);
      console.log(`  Bribe Amount: ${bribeAmount}`);

      console.log("\n=== [AUTO SNIPE BUY PARAMETERS] ===");
      console.log(`Active Buy Preset Index: ${userPreset?.activeBuyPreset ?? 0}`);
      console.log(`Preset Object:`, activePreset);
      console.log(`Buy Amount (lamports): ${buyAmount} (${buyAmount / 1e9} SOL)`);
      console.log(`Slippage: ${slippage}`);
      console.log(`Priority Fee (lamports): ${priorityFee} (${priorityFee / 1e9} SOL)`);
      console.log(`Bribe Amount (lamports): ${bribeAmount} (${bribeAmount / 1e9} SOL)`);
      console.log("====================================\n");

      const totalRequired = buyAmount + priorityFee + bribeAmount + 10_000_000;

      const balance = await connection.getBalance(userPublicKey);
      if (balance < totalRequired) {
        console.error(
          `❌ Insufficient balance. Need ${totalRequired / 1e9} SOL (including fees)`
        );
        return;
      }

      //console.log("\n=== 💰 TRANSACTION BREAKDOWN ===");
      //console.log(`Priority Fee: ${priorityFee / 1e9} SOL`);
      //console.log(`Bribe Amount: ${bribeAmount / 1e9} SOL`);
      //console.log(`Network Fee Buffer: 0.01 SOL`);
      //console.log(`Slippage: ${settings.slippage}%`);
      //console.log("==============================\n");

      const buyPriceAtDetection = await getCurrentPrice(
        connection,
        mintAddress,
        userPublicKey
      );
      
      //console.log(
        //`[DEBUG] 13. Fetching keypair for buy transaction for user ID: ${userId}`
        //);
      const autoBuyStartTime = Date.now();
      const signature = await buyToken({
        connection,
        userKeypair: await getUserKeypairById(userId),
        programId: MEMEHOME_PROGRAM_ID,
        amount: buyAmount,
        minOut: MIN_OUT_AMOUNT,
        direction: DIRECTION,
        swapAccounts,
        slippage: slippage,
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

        // ADD THIS: Send updated SOL balance
        const updatedBalance = await connection.getBalance(userPublicKey);
        userSession.ws.send(JSON.stringify({
          type: "SOL_BALANCE_UPDATE",
          balance: updatedBalance / 1e9,
        }));

        console.log(`💰 Token detection price: ${detectionPrice} SOL`);

        //await addOrUpdateTokenFromBuy({
          //mint: mintAddress,
          //buyPrice: buyPriceAtDetection,
          //amount: tokensReceived.toString(),
          //userPublicKey: userPublicKey.toBase58(),
        //});
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

// Add this map at the top to track auto fee intervals per user
const autoFeeIntervals = new Map<string, NodeJS.Timeout>();

export function setupWebSocketHandlers(wss: WebSocketServer) {
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
            ws.send(JSON.stringify({ type: "AUTH_ERROR", error: "No token provided" }));
            return;
          }
          
          // Special case for auto-sell worker
          if (authToken === 'auto-sell-worker') {
            ws.userId = 'auto-sell-worker';
            ws.walletAddress = 'auto-sell-worker';
            ws.send(JSON.stringify({
              type: "AUTH_SUCCESS",
              message: "Auto-sell worker authenticated successfully",
              walletAddress: 'auto-sell-worker',
            }));
            return;
          }
          
          const decoded = verifyToken(authToken);
          if (!decoded) {
            ws.send(JSON.stringify({ type: "AUTH_ERROR", error: "Invalid token" }));
            return;
          }
          ws.userId = decoded.id;
          ws.walletAddress = decoded.walletAddress;

          await ensureUserPreset(ws.userId);

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
              walletAddress: decoded.walletAddress,
            })
          );

          // ADD THIS: Send initial SOL balance
          const connection = getConnection();
          const initialBalance = await connection.getBalance(userKeypair.publicKey);
          ws.send(JSON.stringify({
            type: "SOL_BALANCE_UPDATE",
            balance: initialBalance / 1e9,
          }));

          const userTokens = await UserToken.find({ userId: ws.userId });
          ws.send(JSON.stringify({
            type: "USER_TOKENS",
            tokens: userTokens
          }));
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
          //console.log("    Old settings:", ws.autoSnipeSettings);
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

        case "AUTO_SELL_TRIGGERED":
        case "AUTO_SELL_SUCCESS":
        case "AUTO_SELL_DISABLED":
          // Broadcast auto-sell notifications to all connected clients
          wss.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
              client.send(JSON.stringify(data));
            }
          });
          break;

        case "SOL_BALANCE_UPDATE":
          // Broadcast SOL balance updates to all connected clients
          wss.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
              client.send(JSON.stringify(data));
            }
          });
          break;

        case "USER_TOKENS":
          // Broadcast user tokens updates to all connected clients
          wss.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
              client.send(JSON.stringify(data));
            }
          });
          break;

        case "MANUAL_BUY":
          console.log("[DEBUG] MANUAL_BUY case started.");

           //Log frontend se aayi values
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
            //const networkFeeBuffer = 2_000_000; // Example buffer
            //const totalRequired = data.amount + (data.priorityFee || 0) + (data.bribeAmount || 0) + networkFeeBuffer;
            //console.log("[MANUAL_BUY] Backend calculation:");
            //console.log("  networkFeeBuffer (lamports):", networkFeeBuffer, "(", networkFeeBuffer / 1e9, "SOL )");
            //console.log("  totalRequired (lamports):", totalRequired, "(", totalRequired / 1e9, "SOL )");
            

            


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
            //console.log("[DEBUG] handleManualBuy result:", result);

            if (result && result.signature) {
              // 1. DB update karo (same as auto-buy)
              await addOrUpdateTokenFromBuy({
                mint: data.mintAddress,
                buyPrice: result.details?.price ?? 0, // Use token price, not SOL
                amount: (result.details?.amount ?? 0).toString(),  // <-- Convert to string
                userPublicKey: userKeypair.publicKey.toBase58(),
                signature: result.signature,
                userID: ws.userId,
              });

              // 2. Client ko success bhejo
              ws.send(
                JSON.stringify({
                  type: "MANUAL_BUY_SUCCESS",
                  signature: result.signature,
                  details: result,
                })
              );

              // ADD THIS: Send updated SOL balance
              const updatedBalance = await getConnection().getBalance(userKeypair.publicKey);
              ws.send(JSON.stringify({
                type: "SOL_BALANCE_UPDATE",
                balance: updatedBalance / 1e9,
              }));

              const userTokens = await UserToken.find({ userId: ws.userId });
              ws.send(JSON.stringify({
                type: "USER_TOKENS",
                tokens: userTokens
              }));
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

          case "MANUAL_SELL": {
            // Log user info for every manual sell request
            console.log("🛒 [MANUAL_SELL] Request received");
            console.log("  ws.userId:", ws.userId);
            console.log("  ws.walletAddress:", ws.walletAddress);
            console.log("  Request walletAddress:", data.walletAddress);

            // Accept both 'mint' and 'mintAddress' for compatibility
            const mint = data.mint || data.mintAddress;
            // Debug: Print all incoming values
            console.log("[MANUAL_SELL] Incoming values:", {
              mint,
              percent: data.percent,
              walletAddress: data.walletAddress,
              slippage: data.slippage,
              priorityFee: data.priorityFee,
              bribeAmount: data.bribeAmount,
              userId: ws.userId,
              wsWalletAddress: ws.walletAddress,
              rawData: data
            });
            // Now destructure
            const {
                percent,
                walletAddress,
                slippage,
                priorityFee,
                bribeAmount,
                amount,
            } = data;

            if (!mint || !percent || !walletAddress) {
                ws.send(JSON.stringify({ type: "ERROR", error: "Missing required fields for manual sell" }));
                return;
            }

            const connection = getConnection();
            let userKeypair;
            try {
                console.log("Step 1: Getting userKeypair...");
                userKeypair = await getUserKeypairByWallet(walletAddress);
                console.log("Step 2: Got userKeypair:", userKeypair.publicKey.toBase58());
            } catch (e) {
                ws.send(JSON.stringify({ type: "ERROR", error: "User wallet not found or decryption failed" }));
                return;
            }
            const mintPubkey = new PublicKey(mint);

            // Get user's token account address (ATA)
            const userTokenAccount = await getAssociatedTokenAddress(mintPubkey, userKeypair.publicKey);
            console.log("Step 3: Getting userTokenAccount...");
            console.log("Step 4: Got userTokenAccount:", userTokenAccount.toBase58());

            // Get live token account info from blockchain
            let tokenAccountInfo;
            try {
                tokenAccountInfo = await getAccount(connection, userTokenAccount);
                console.log("Step 5: Getting tokenAccountInfo...");
                console.log("Step 6: Got tokenAccountInfo");
            } catch (e) {
                ws.send(JSON.stringify({ type: "MANUAL_SELL_ERROR", error: "Token account not found in wallet" }));
                return;
            }

            // Get decimals (prefer chain, fallback to UserToken)
            const userTokenForDebug = await UserToken.findOne({ mint, walletAddress });
            const decimalsForDebug = userTokenForDebug?.decimals ?? 6;
            // Get raw chain balance (no decimals division)
            const chainBalanceRaw = Number(tokenAccountInfo.amount); // RAW
            console.log("[DEBUG] Step 9: chainBalance (RAW):", chainBalanceRaw);
            // Calculate sell amount as % of raw balance
            let sellAmountInSmallestUnit;
            if (typeof amount === 'number' && amount > 0) {
              // If amount is provided, use it directly (already in smallest unit)
              sellAmountInSmallestUnit = amount;
            } else {
              // Calculate based on percent of raw chain balance
              let sellAmount = (chainBalanceRaw * percent) / 100;
              sellAmountInSmallestUnit = Math.floor(sellAmount);
            }
            console.log("[DEBUG] Sell Amount Calculation: percent:", percent, "sellAmountInSmallestUnit:", sellAmountInSmallestUnit);

            if (sellAmountInSmallestUnit <= 0) {
                ws.send(JSON.stringify({ type: "MANUAL_SELL_ERROR", error: "Sell amount too small" }));
                return;
            }

            // 4. Log all details
            console.log("\n=== MANUAL SELL REQUEST ===");
            console.log("User Wallet:", walletAddress);
            console.log("User PublicKey:", userKeypair.publicKey.toBase58());
            console.log("Token Mint:", mint);
            console.log("Sell Percentage:", percent + "%");
            console.log("Token Amount:", chainBalanceRaw);
            console.log("Decimals:", decimalsForDebug);
            console.log("Sell Amount:", sellAmountInSmallestUnit);

            // 5. Prepare Solana connection and swap accounts
            const swapAccounts = await getSwapAccounts({
                mintAddress: mint,
                buyer: userKeypair.publicKey,
                connection,
              programId: MEMEHOME_PROGRAM_ID,
            });
            console.log("Step 10: Getting swapAccounts...");
            console.log("Step 11: Got swapAccounts");

            // 6. Get reserves for expected output calculation
            const tokenVaultInfo = await connection.getTokenAccountBalance(swapAccounts.curveTokenAccount);
            const tokenReserve = BigInt(tokenVaultInfo.value.amount);
            const bondingCurveInfo = await connection.getAccountInfo(swapAccounts.bondingCurve);
            if (!bondingCurveInfo) {
                ws.send(JSON.stringify({ type: "MANUAL_SELL_ERROR", error: "Bonding curve account not found" }));
                return;
            }
            const solReserve = BigInt(bondingCurveInfo.lamports);
            console.log("Step 12: Getting tokenVaultInfo...");
            console.log("Step 13: Got tokenVaultInfo");
            console.log("Step 14: Getting bondingCurveInfo...");
            console.log("Step 15: Got bondingCurveInfo");

            // 7. Calculate expected output
            const expectedSolOut = calculateAmountOut(
                BigInt(sellAmountInSmallestUnit),
                tokenReserve,
                solReserve
            );
            console.log("Step 16: Calculating expectedSolOut...");
            console.log("expectedSolOut:", expectedSolOut);

            // 8. Log reserves and expected output
            console.log("Token Reserve:", tokenReserve.toString());
            console.log("SOL Reserve:", solReserve.toString());
            console.log("Expected SOL Output (before slippage):", Number(expectedSolOut) / 1e9, "SOL");

            // 9. Prepare sell parameters
            const slippageValue = Number(slippage) || 0;
            const priorityFeeValue = Number(priorityFee) || 0;
            const bribeAmountValue = Number(bribeAmount) || 0;

            // 10. Execute sell
            try {
                const preBalance = await connection.getBalance(userKeypair.publicKey);
                const manualSellStartTime = Date.now();

                let txSignature;
                if (userKeypair.publicKey.toBase58() === walletAddress) {
                    txSignature = await sellToken({
                        connection,
                        userKeypair,
                programId: MEMEHOME_PROGRAM_ID,
                        amount: BigInt(sellAmountInSmallestUnit),
                        minOut: expectedSolOut / 100n, // 1% slippage (or override with slippage param)
                        swapAccounts,
                        slippage: slippageValue,
                        priorityFee: priorityFeeValue,
                        bribeAmount: bribeAmountValue,
                    });
                    console.log("Step 17: Executing sellToken...");
                    console.log("Step 18: Got txSignature:", txSignature);
                } else {
                    // If the wallet address is different, we need to create a new transaction
                    const createAtaIx = createAssociatedTokenAccountInstruction(
                        userKeypair.publicKey,
                        swapAccounts.curveTokenAccount,
                        swapAccounts.bondingCurve,
                        swapAccounts.tokenMint
                    );

                    const createAtaTx = new Transaction().add(createAtaIx);
                    createAtaTx.feePayer = userKeypair.publicKey;
                    createAtaTx.recentBlockhash = (
                        await connection.getLatestBlockhash()
                    ).blockhash;

                    createAtaTx.sign(userKeypair);

                    txSignature = await connection.sendRawTransaction(
                        createAtaTx.serialize()
                    );
                }

                if (txSignature) {
                    await connection.confirmTransaction(txSignature);
                }
                const manualSellEndTime = Date.now();
                const postBalance = await connection.getBalance(userKeypair.publicKey);
                const actualSolReceived = (postBalance - preBalance) / 1e9;

                // After sell transaction is confirmed
                let updatedChainBalanceRaw = 0;
                try {
                  const updatedTokenAccountInfo = await getAccount(connection, userTokenAccount);
                  console.log("[DEBUG] After Sell: updatedTokenAccountInfo.amount (raw):", updatedTokenAccountInfo.amount);
                  updatedChainBalanceRaw = Number(updatedTokenAccountInfo.amount); // RAW
                  console.log("[DEBUG] After Sell: updatedChainBalance (RAW):", updatedChainBalanceRaw);
                } catch (e) {
                  updatedChainBalanceRaw = 0; // If account is closed, treat as zero
                }
                // Update or remove UserToken in DB (RAW)
                if (updatedChainBalanceRaw <= 0 || Math.abs(updatedChainBalanceRaw) < 1e-6) {
                  await UserToken.deleteOne({ mint, walletAddress });
                } else {
                  await UserToken.findOneAndUpdate(
                    { mint, walletAddress },
                    { $set: { balance: updatedChainBalanceRaw } }
                  );
                }
                const userToken = await UserToken.findOne({ mint, walletAddress });
                console.log("[DEBUG] DB UserToken after update (RAW):", userToken);
                // 11. Log transaction summary
                console.log("\n=== MANUAL SELL SUMMARY (RAW) ===");
                console.log(`User: ${walletAddress} (${userKeypair.publicKey.toBase58()})`);
                console.log(`Tokens Sold: ${sellAmountInSmallestUnit} (RAW)`);
                // FIX 1: Use actual updated chain balance (RAW)
                const remainingAmount = updatedChainBalanceRaw; // RAW
                console.log("Remaining Amount (RAW):", remainingAmount);

                console.log(`Expected SOL Output (before slippage): ${Number(expectedSolOut) / 1e9} SOL`);
                const expectedSolOutWithSlippage = (Number(expectedSolOut) * (1 - slippageValue / 100)) / 1e9;
                console.log(`Expected SOL Output (after slippage): ${expectedSolOutWithSlippage} SOL`);
                console.log(`Priority Fee: ${priorityFeeValue} SOL`);
                console.log(`Bribe Amount: ${bribeAmountValue} SOL`);
                console.log(`Actual SOL Received (wallet diff): ${actualSolReceived} SOL`);
                console.log(`Execution Time: ${manualSellEndTime - manualSellStartTime} ms`);
                console.log("============================\n");

                // FIX 2: Update database with actual remaining amount
                await updateOrRemoveTokenAfterSell({
                    mint,
                    userPublicKey: walletAddress,
                    remainingAmount: remainingAmount.toString(), // Use actual updatedChainBalance
                    signature: txSignature || "",
                });

                // 13. Send success response
                ws.send(
                  JSON.stringify({
                    type: "MANUAL_SELL_SUCCESS",
                    signature: txSignature,
                    details: {
                      mint,
                      soldAmount: sellAmountInSmallestUnit.toString(),
                      remainingAmount: remainingAmount.toString(),
                      expectedSolOut: expectedSolOut.toString(),
                      executionTimeMs: manualSellEndTime - manualSellStartTime,
                      isAutoSell: data.isAutoSell || false, // Pass through the auto-sell flag
                    },
                  })
                );

                // Send auto-sell success notification if this was an auto-sell
                if (data.isAutoSell) {
                  ws.send(JSON.stringify({
                    type: "AUTO_SELL_SUCCESS",
                    mint,
                    signature: txSignature,
                    soldAmount: sellAmountInSmallestUnit.toString(),
                    remainingAmount: remainingAmount.toString(),
                    actualSolReceived,
                    executionTimeMs: manualSellEndTime - manualSellStartTime,
                  }));
                }

                // ADD THIS: Send updated token list to frontend
                const userTokens = await UserToken.find({ walletAddress });
                console.log("[DEBUG] Sending USER_TOKENS to frontend:", userTokens);
                ws.send(JSON.stringify({
                  type: "USER_TOKENS",
                  tokens: userTokens
                }));

                // ADD THIS: Send updated SOL balance
                const updatedBalance = await getConnection().getBalance(userKeypair.publicKey);
                ws.send(JSON.stringify({
                  type: "SOL_BALANCE_UPDATE",
                  balance: updatedBalance / 1e9,
                }));

                // --- NEW: Broadcast to all clients if auto-sell ---
                if (data.isAutoSell) {
                  wss.clients.forEach(client => {
                    const wsClient = client as WSWithUser;
                    if (
                      client.readyState === 1 && // WebSocket.OPEN
                      wsClient.walletAddress === walletAddress
                    ) {
                      wsClient.send(JSON.stringify({
                        type: "USER_TOKENS",
                        tokens: userTokens
                      }));
                      wsClient.send(JSON.stringify({
                        type: "SOL_BALANCE_UPDATE",
                        balance: updatedBalance / 1e9,
                      }));
                    }
                  });
                }

          } catch (error) {
                console.error("❌ Manual sell failed:", error);
            ws.send(
              JSON.stringify({
                type: "MANUAL_SELL_ERROR",
                error: error instanceof Error ? error.message : "Unknown error",
              })
            );
          }
          break;
          }

        case "RESET_STATE":
          console.log(`[INFO] User ${ws.userId} returned to initial state`);
          ws.autoSnipeSettings = { ...defaultAutoSnipeSettings };
          ws.trackedTokens = [];
          break;

          case "GET_USER_TOKENS": {
            console.log("[WS] GET_USER_TOKENS for ws.walletAddress:", ws.walletAddress);
            if (!ws.walletAddress) {
                ws.send(JSON.stringify({ type: "ERROR", error: "User not authenticated" }));
                break;
            }
            const userTokens = await UserToken.find({ userId: ws.userId });
            console.log("[WS] userId for USER_TOKENS:", ws.userId);
            console.log("[WS] Tokens found:", userTokens);
            ws.send(JSON.stringify({ type: "USER_TOKENS", tokens: userTokens }));
            break;
          }

          case "UPDATE_AUTO_SELL_SETTINGS":
            if (!ws.walletAddress) {
              ws.send(JSON.stringify({ type: 'ERROR', error: 'Unauthorized' }));
              return;
            }
            // Update settings in DB for this user/token
            //await AutoSell.updateOne(
              //{ mint: data.payload.mint, userPublicKey: ws.walletAddress },
              //{ $set: data.payload },
              //{ upsert: true }
            //);
            ws.send(JSON.stringify({ type: 'AUTO_SELL_SETTINGS_UPDATED', message: 'Settings updated!' }));
            break;

          case "AUTO_SELL_CONNECT": {
            console.log("[WS] AUTO_SELL_CONNECT for ws.walletAddress:", ws.walletAddress);
            if (!ws.walletAddress) {
                ws.send(JSON.stringify({ type: "ERROR", error: "User not authenticated" }));
                break;
            }
            const userTokens = await UserToken.find({ userPublicKey: ws.walletAddress });
            console.log("[WS] WalletToken.find result (AUTO_SELL_CONNECT):", userTokens.length, "tokens");
            ws.send(JSON.stringify({ type: "USER_TOKENS", tokens: userTokens }));
            break;
          }

          case "GET_TOKEN_PRICES": {
            console.log("[WS] GET_TOKEN_PRICES request received");
            if (!ws.walletAddress) {
                ws.send(JSON.stringify({ type: "ERROR", error: "User not authenticated" }));
                break;
            }
            const prices = await TokenPrice.find({ userPublicKey: ws.walletAddress });
            ws.send(JSON.stringify({ type: "TOKEN_PRICES", prices }));
            break;
          }

          case "GET_USER_AUTOSELL_CONFIGS": {
            if (!ws.walletAddress) {
                ws.send(JSON.stringify({ type: "ERROR", error: "User not authenticated" }));
                break;
            }
            //const configs = await AutoSell.find({ userPublicKey: ws.walletAddress });
            //ws.send(JSON.stringify({ type: "USER_AUTOSELL_CONFIGS", configs }));
            break;
          }

        case "GET_PRESETS": {
          console.log("🟢 [WS] GET_PRESETS message received from userId:", ws.userId);

          if (!ws.userId) {
            ws.send(JSON.stringify({ type: "ERROR", error: "User not authenticated" }));
            console.log("🔴 [WS] GET_PRESETS: User not authenticated, aborting.");
            break;
          }
          let userPreset = await UserPreset.findOne({ userId: ws.userId });
          if (!userPreset) {
            console.log("🟡 [WS] No userPreset found, creating default for userId:", ws.userId);
            userPreset = await UserPreset.create({
              userId: ws.userId,
              buyPresets: [{}, {}, {}],
              sellPresets: [{}, {}, {}],
              activeBuyPreset: 0,
              activeSellPreset: 0,
            });
          }
          console.log("🟢 [WS] Sending PRESETS to frontend:", {
            buyPresets: userPreset.buyPresets,
            sellPresets: userPreset.sellPresets,
            activeBuyPreset: userPreset.activeBuyPreset,
            activeSellPreset: userPreset.activeSellPreset,
          });
          ws.send(JSON.stringify({
            type: "PRESETS",
            buyPresets: userPreset.buyPresets,
            sellPresets: userPreset.sellPresets,
            activeBuyPreset: userPreset.activeBuyPreset,
            activeSellPreset: userPreset.activeSellPreset,
          }));
          break;
        }

        case "APPLY_PRESET": {
          const { mode, presetIndex } = data;
          if (!ws.userId) break;
          const userPreset = await UserPreset.findOne({ userId: ws.userId });
          if (!userPreset) break;
          if (mode === "buy") userPreset.activeBuyPreset = presetIndex;
          else if (mode === "sell") userPreset.activeSellPreset = presetIndex;
          await userPreset.save();
          ws.send(JSON.stringify({ type: "ACTIVE_PRESET_UPDATED", mode, presetIndex }));
          // --- Add this: ---
          ws.send(JSON.stringify({
            type: "PRESETS",
            buyPresets: userPreset.buyPresets,
            sellPresets: userPreset.sellPresets,
            activeBuyPreset: userPreset.activeBuyPreset,
            activeSellPreset: userPreset.activeSellPreset,
          }));
          break;
        }

        case "UPDATE_PRESET": {
          const { mode, presetIndex, settings } = data;
          if (!ws.userId) break;
          const userPreset = await UserPreset.findOne({ userId: ws.userId });
          if (!userPreset) break;
          if (mode === "buy") {
            userPreset.buyPresets[presetIndex] = { ...userPreset.buyPresets[presetIndex], ...settings };
          } else {
            userPreset.sellPresets[presetIndex] = { ...userPreset.sellPresets[presetIndex], ...settings };
          }
          await userPreset.save();
          ws.send(JSON.stringify({ type: "PRESET_UPDATED", mode, presetIndex, settings }));
          // --- Add this: ---
          ws.send(JSON.stringify({
            type: "PRESETS",
            buyPresets: userPreset.buyPresets,
            sellPresets: userPreset.sellPresets,
            activeBuyPreset: userPreset.activeBuyPreset,
            activeSellPreset: userPreset.activeSellPreset,
          }));
          break;
        }

        // --- NEW: SUBSCRIBE_AUTO_FEE ---
        case "SUBSCRIBE_AUTO_FEE": {
          if (!ws.userId) break;
          // Clear any existing interval
          if (autoFeeIntervals.has(ws.userId)) {
            clearInterval(autoFeeIntervals.get(ws.userId)!);
          }
          const { Connection } = require("@solana/web3.js");

          const MAINNET_RPC_URL = "https://mainnet.helius-rpc.com/?api-key=d70232c8-cb8c-4fb0-9d3f-985fc6f90880"; // <-- apna RPC daalein
          const mainnetConnection = new Connection(MAINNET_RPC_URL, "confirmed");
          // Start sending auto fee updates every 5 seconds
          const interval = setInterval(async () => {
            try {
              // 1. Get recent prioritization fees
              const fees = await mainnetConnection.getRecentPrioritizationFees();
              let priorityFee = 0;
              if (fees && fees[0]) {
                priorityFee = fees[0].prioritizationFee / 1e9;
              }
              // 2. Minimum threshold (e.g. 0.001 SOL)
              if (priorityFee < 0.001) priorityFee = 0.001;
              const priorityFeeStr = priorityFee.toFixed(5);

              let bribeAmount = priorityFee * 2;
              if (bribeAmount < 0.001) bribeAmount = 0.001;
              const bribeAmountStr = (bribeAmount).toFixed(5);

              ws.send(JSON.stringify({
                type: "AUTO_FEE_UPDATE",
                priorityFee: priorityFeeStr,
                bribeAmount: bribeAmountStr,
              }));
            } catch (e) {
              console.error("Failed to fetch network fees:", e);
              ws.send(JSON.stringify({
                type: "AUTO_FEE_UPDATE",
                priorityFee: "0.001",
                bribeAmount: "0.001"
              }));
            }
          }, 5000);
          autoFeeIntervals.set(ws.userId, interval);
          break;
        }

        // --- NEW: UNSUBSCRIBE_AUTO_FEE ---
        case "UNSUBSCRIBE_AUTO_FEE": {
          if (!ws.userId) break;
          if (autoFeeIntervals.has(ws.userId)) {
            clearInterval(autoFeeIntervals.get(ws.userId)!);
            autoFeeIntervals.delete(ws.userId);
          }
          break;
        }

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

    // Clean up interval on disconnect
    if (ws.userId && autoFeeIntervals.has(ws.userId)) {
      clearInterval(autoFeeIntervals.get(ws.userId)!);
      autoFeeIntervals.delete(ws.userId);
    }
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
  });
});
}

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

async function ensureUserPreset(userId: string) {
  let userPreset = await UserPreset.findOne({ userId });
  if (!userPreset) {
    userPreset = await UserPreset.create({
      userId,
      buyPresets: [{}, {}, {}],
      sellPresets: [{}, {}, {}],
      activeBuyPreset: 0,
      activeSellPreset: 0,
    });
  }
  return userPreset;
}


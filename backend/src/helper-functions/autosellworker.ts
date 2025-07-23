import dotenv from 'dotenv';
dotenv.config();

import AutoSell from '../models/autoSell';
import { getCurrentPrice } from './getCurrentPrice';
import { getConnection } from '../utils/getProvider';
import { getUserKeypairByWallet } from '../utils/userWallet';
import WebSocket from 'ws';
import { UserToken } from '../models/userToken'; // Added import for UserToken
import UserFilterPreset from '../models/UserFilterPreset';
import { createJupiterApiClient } from '@jup-ag/api';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { BN } from 'bn.js';

let autoSellWorkerInterval: NodeJS.Timeout | null = null;
let ws: WebSocket | null = null;

// amazonq-ignore-next-line
//const apiLink = process.env.API_LINK;
// amazonq-ignore-next-line
const wslink = process.env.WS_LINK;
const port = process.env.API_PORT;

// --- WebSocket Setup ---
// amazonq-ignore-next-line
function getOrCreateWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return ws;
  if (ws && ws.readyState === WebSocket.CONNECTING) return ws;

  ws = new WebSocket(`${wslink}:${port}`);
  ws.on('open', () => {
    console.log('[AutoSellWorker] WebSocket connected');
    // Authenticate the WebSocket connection
    if (ws) {
      ws.send(JSON.stringify({
        type: 'AUTHENTICATE',
        token: process.env.BOT_AUTH_TOKEN || 'auto-sell-worker'
      }));
    }
  });
  ws.on('close', () => {
    console.log('[AutoSellWorker] WebSocket closed, will reconnect on next send');
    ws = null;
  });
  ws.on('error', (err) => {
    console.error('[AutoSellWorker] WebSocket error:', err);
    ws = null;
  });

  // Listen for MANUAL_SELL_SUCCESS to disable autoSellEnabled
  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'MANUAL_SELL_SUCCESS' && data.mint && data.walletAddress) {
        // Disable autoSellEnabled for this config
        await AutoSell.updateOne(
          { mint: data.mint, walletAddress: data.walletAddress },
          { $set: { autoSellEnabled: false } }
        );
        console.log(`[AutoSellWorker] AutoSell disabled for mint: ${data.mint}, wallet: ${data.walletAddress}`);
      }
    } catch (err) {
      console.error('[AutoSellWorker] Error processing WS message:', err);
    }
  });

  return ws;
}

// amazonq-ignore-next-line
function sendManualSellMessage(data: any) {
  const ws = getOrCreateWebSocket();
  const payload = { type: 'MANUAL_SELL', ...data };
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
      console.log('[AutoSellWorker] MANUAL_SELL sent:', payload);
    } catch (err) {
      console.error('[AutoSellWorker] MANUAL_SELL send error:', err);
    }
  } else {
    ws.once('open', () => {
      try {
        ws.send(JSON.stringify(payload));
        console.log('[AutoSellWorker] MANUAL_SELL sent after open:', payload);
      } catch (err) {
        console.error('[AutoSellWorker] MANUAL_SELL send error after open:', err);
      }
    });
  }
}

// Helper function to execute the sell and perform related actions
async function executeSell(config: any, reason: string, currentPrice?: number) {
  const ws = getOrCreateWebSocket();
  let profitLossPercent: number | undefined;

  if (currentPrice !== undefined && config.buyPrice) {
    profitLossPercent = ((currentPrice - config.buyPrice) / config.buyPrice) * 100;
  }

  console.log(
    `🔔 AutoSell triggered for user: ${config.userId}, token: ${config.mint}, Reason: ${reason}, P/L: ${profitLossPercent ? profitLossPercent.toFixed(2) + '%' : 'N/A'}`
  );

  // Send auto-sell notification to frontend
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "AUTO_SELL_TRIGGERED",
      mint: config.mint,
      walletAddress: config.walletAddress,
      percent: config.autoSellPercent,
      profitLoss: profitLossPercent,
      reason: reason,
      tokenName: config.tokenName || 'Unknown Token'
    }));
  }

  sendManualSellMessage({
    mint: config.mint,
    percent: config.autoSellPercent,
    walletAddress: config.walletAddress,
    slippage: config.slippage,
    priorityFee: config.priorityFee,
    bribeAmount: config.bribeAmount,
    isAutoSell: true,
  });

  // Immediately disable autoSellEnabled to prevent repeated sells
  await AutoSell.updateOne(
    { _id: config._id },
    { $set: { autoSellEnabled: false } }
  );
  console.log(`[AutoSellWorker] AutoSell immediately disabled for mint: ${config.mint}, wallet: ${config.walletAddress}`);

  // Send auto-sell disabled notification
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "AUTO_SELL_DISABLED",
      mint: config.mint,
      walletAddress: config.walletAddress,
      tokenName: config.tokenName || 'Unknown Token'
    }));
  }
}

export async function checkAndExecuteAllAutoSells() {
  const autoSells = await AutoSell.find({ autoSellEnabled: true });
  console.log('[AutoSellWorker] checkAndExecuteAllAutoSells, active:', autoSells.length);
  const connection = getConnection();

  // --- Pre-fetch user filter presets for efficiency ---
  // amazonq-ignore-next-line
  const userIds = [...new Set(autoSells.map(s => s.userId.toString()))];
  const presets = await UserFilterPreset.find({ userId: { $in: userIds } }).lean();
  const presetsMap = new Map(presets.map(p => [p.userId, p]));

  for (const config of autoSells) {
    try {
      // --- 0. BLOCKED TOKEN CHECK (HIGHEST PRIORITY) ---
      const userPreset = presetsMap.get(config.userId.toString());
      if (userPreset && userPreset.sellFilters?.blockedTokens?.includes(config.mint)) {
        console.log(`[AutoSellWorker] ⛔ Token ${config.mint} for user ${config.userId} is blocked — skipping auto-sell.`);
        continue; // Skip all other checks if token is blocked
      }

      // amazonq-ignore-next-line
      console.log("After Blocked TOken")

      // --- 1. FRONT-RUN PROTECTION CHECK ---
      if (userPreset?.sellFilters?.frontRunProtection) {

        const platform = 'devnet'
        // Jupiter V6 API is for Mainnet. We bypass this check on Devnet.
        if (platform === 'devnet') {
          console.log(`[AutoSellWorker] 🟡 Bypassing front-run simulation on Devnet.`);
        } else {
          console.log(`[AutoSellWorker] 🛡️ Front-run protection enabled for ${config.mint}. Simulating sell...`);
          try {
            const userKeypair = await getUserKeypairByWallet(config.walletAddress);
            if (!userKeypair) {
              console.log(`[AutoSellWorker] No keypair for ${config.walletAddress}, cannot simulate sell.`);
              continue;
            }

            const jupiterApi = createJupiterApiClient(); // Mainnet by default
            const tokenMint = new PublicKey(config.mint);

            const tokenAccount = await connection.getParsedTokenAccountsByOwner(userKeypair.publicKey, { mint: tokenMint });
            if (!tokenAccount.value.length) {
              console.log(`[AutoSellWorker] No token account found for ${config.mint} to simulate.`);
              continue;
            }

            const tokenInfo = tokenAccount.value[0].account.data.parsed.info;
            const amountToSell = new BN(tokenInfo.tokenAmount.amount)
              .mul(new BN(config.autoSellPercent || 100))
              .div(new BN(100));

            if (amountToSell.isZero()) {
              console.log(`[AutoSellWorker] Amount to sell is zero for ${config.mint}, skipping simulation.`);
              continue;
            }

            const quoteResponse = await jupiterApi.quoteGet({
              inputMint: config.mint,
              outputMint: "So11111111111111111111111111111111111111112", // SOL
              amount: amountToSell.toNumber(),
              slippageBps: (config.slippage || 15) * 100,
            });

            if (!quoteResponse) {
              console.log("[AutoSellWorker] No Jupiter quote found for simulation.");
              continue;
            }

            const { swapTransaction } = await jupiterApi.swapPost({
              swapRequest: {
                quoteResponse: quoteResponse,
                userPublicKey: userKeypair.publicKey.toBase58(),
              }
            });

            const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
            const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
            transaction.sign([userKeypair]);

            const simulationResult = await connection.simulateTransaction(transaction);
            if (simulationResult.value.err) {
              console.log(`[AutoSellWorker] 🛡️ Front-run protection triggered for ${config.mint}. Simulation failed!`, simulationResult.value.err);
              console.log("[AutoSellWorker] Logs:", simulationResult.value.logs);
              continue;
            }

            console.log(`[AutoSellWorker] ✅ Simulation successful for ${config.mint}. Proceeding with sell checks.`);

          } catch (simError) {
            console.error(`[AutoSellWorker] 🛡️ Front-run simulation error for ${config.mint}:`, simError);
            continue;
          }
        }
      }

      console.log("After Front run");

      // --- 2. MIN LIQUIDITY CHECK ---
      const minLiquidity = userPreset?.sellFilters?.minLiquidity;
      const platform = 'devnet'; // TODO: set to 'mainnet' on production
      if (typeof minLiquidity === 'number' && minLiquidity > 0) {
        if (platform === 'devnet') {
          console.log(`[AutoSellWorker] 🟡 Bypassing min liquidity check on Devnet.`);
        } else {
          // --- Mainnet Liquidity Check (Uncomment when poolAddress is available) ---
          console.log(`[AutoSellWorker] ⚠️ Mainnet liquidity check skipped: poolAddress not yet implemented in model.`);
          /*
          if (!config.poolAddress) {
            console.log(`[AutoSellWorker] ⚠️ No pool address set for ${config.mint}, skipping liquidity check.`);
          } else {
            const poolSolBalance = await connection.getBalance(new PublicKey(config.poolAddress));
            const poolSol = poolSolBalance / 1e9; // lamports to SOL
            if (poolSol < minLiquidity) {
              console.log(`[AutoSellWorker] 💧 Not enough liquidity (${poolSol} SOL < ${minLiquidity} SOL) — skipping auto-sell for ${config.mint}`);
              continue;
            }
          }
          */
        }
      }

      console.log("After Min liquidate");

      // --- 3. WAIT FOR BUYERS BEFORE SELL CHECK ---
      if (config.waitForBuyersBeforeSellEnabled) {
        try {
          const buyersCount = await import('./getBuyersCount').then(mod => mod.getBuyersCount(config.mint));
          if (typeof config.waitForBuyersBeforeSell === 'number' && buyersCount < config.waitForBuyersBeforeSell) {
            console.log(`[AutoSellWorker] ⏳ Waiting for more buyers: ${buyersCount}/${config.waitForBuyersBeforeSell} for mint: ${config.mint}`);
            continue;
          }
        } catch (err) {
          console.error(`[AutoSellWorker] Error getting buyers count for mint ${config.mint}:`, err);
          continue;
        }
      }

      console.log("After Wait for Buyer");

      // --- 4. TIME-BASED SELL CHECK ---
      if (config.timeBasedSellEnabled) {
        if (typeof config.timeBasedSellSec !== 'number' || config.timeBasedSellSec <= 0) {
          console.log(`[AutoSellWorker] ⚠️ Invalid timeBasedSellSec (${config.timeBasedSellSec}) for user: ${config.userId}, token: ${config.mint}`);
          continue;
        }
        if (config.boughtTime instanceof Date && !isNaN(config.boughtTime.getTime())) {
          const now = new Date();
          const secondsSinceBought = (now.getTime() - config.boughtTime.getTime()) / 1000;
          if (secondsSinceBought >= config.timeBasedSellSec) {
            await executeSell(config, 'time-based');
            continue; // Do not process any other sell logic if time-based sell is triggered
          } else {
            console.log(`[AutoSellWorker] ⏳ Time-based sell not triggered yet for user: ${config.userId}, token: ${config.mint}, seconds since bought: ${secondsSinceBought}`);
            continue; // Do not process any other sell logic if time-based sell is enabled but not yet triggered
          }
        } else {
          console.log(`[AutoSellWorker] ⚠️ Invalid boughtTime for user: ${config.userId}, token: ${config.mint}`);
          continue;
        }
      }

      console.log("AFTER TIME BASED SELL");

      // Get userKeypair for price fetch
      const userKeypair = await getUserKeypairByWallet(config.walletAddress);
      if (!userKeypair) continue;

      // Get current price
      const currentPrice = await getCurrentPrice(connection, config.mint, userKeypair.publicKey);
      if (currentPrice === null || currentPrice === undefined) {
        console.log(`[AutoSellWorker] Could not fetch current price for ${config.mint}, skipping sell checks.`);
        continue;
      }

      console.log("CURRENT PRICE: ", currentPrice);

      // --- 5. TRAILING STOP LOSS CHECK ---
      if (config.trailingStopLossEnabled) {
        if (typeof config.trailingStopLossPercent === 'number' && config.trailingStopLossPercent > 0) {
          let peakPrice = config.peakPrice || config.buyPrice;

          console.log("PEAK PRICE", peakPrice);
          console.log("TYPE OF PEAK PRICE", typeof (peakPrice));
          console.log("TYPE OF CURRENT PRICE", typeof (currentPrice));
          if (currentPrice > peakPrice) {
            peakPrice = currentPrice;
            await AutoSell.updateOne({ _id: config._id }, { $set: { peakPrice: peakPrice } });
            console.log(`[AutoSellWorker] ✨ New peak price for ${config.mint}: ${peakPrice}`);
          }

          const triggerPrice = peakPrice * (1 - config.trailingStopLossPercent / 100);
          console.log(`[AutoSellWorker] Trailing Stop for ${config.mint}: Current=${currentPrice}, Peak=${peakPrice}, Trigger=${triggerPrice}`);

          if (currentPrice <= triggerPrice) {
            await executeSell(config, 'trailing-stop-loss', currentPrice);
            // Immediately disable autoSellEnabled to prevent repeated sells
            await AutoSell.updateOne(
              { _id: config._id },
              { $set: { peakPrice: 0 } }
            );
            continue; // Sell is triggered, move to next token
          } else {
            // Trailing is enabled but not triggered, so we hold and skip other sell checks.
            console.log(`[AutoSellWorker] Holding ${config.mint} under trailing stop loss.`);
            continue;
          }
        }
      }

      // --- 6. TAKE PROFIT / STOP LOSS CHECK (Only runs if Time-Based and Trailing are disabled) ---
      const buyPrice = config.buyPrice;
      if (!buyPrice) continue;
      const profitLossPercent = ((currentPrice - buyPrice) / buyPrice) * 100;

      // Check takeProfit/stopLoss
      let shouldSell = false;
      let reason = '';
      if (typeof config.takeProfit === 'number' && profitLossPercent >= config.takeProfit) {
        shouldSell = true;
        reason = 'take-profit';
      }
      if (typeof config.stopLoss === 'number' && profitLossPercent <= -Math.abs(config.stopLoss)) {
        shouldSell = true;
        reason = 'stop-loss';
      }

      if (shouldSell) {
        await executeSell(config, reason, currentPrice);
      }
    } catch (error) {
      console.error(`[AutoSellWorker] Error processing auto-sell for mint ${config.mint}:`, error);
    }
  }
}

async function batchPriceSync() {
  // Fetch all user tokens instead of auto-sell configs
  const userTokens = await UserToken.find({});
  // amazonq-ignore-next-line
  console.log('[AutoSellWorker] batchPriceSync, processing tokens:', userTokens.length);
  const connection = getConnection();
  const BATCH_SIZE = 3;

  for (let i = 0; i < userTokens.length; i += BATCH_SIZE) {
    const batch = userTokens.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (token) => {
      try {
        // We need walletAddress to get the keypair for price fetching.
        // If your UserToken model doesn't have walletAddress, you need to add it.
        // For now, assuming it exists. If not, this is the next thing to fix.
        if (!token.walletAddress) {
          console.log(`[AutoSellWorker] Skipping token ${token.mint} because it has no walletAddress.`);
          return;
        }

        console.log('[AutoSellWorker] Processing:', token.mint, token.walletAddress);
        const userKeypair = await getUserKeypairByWallet(token.walletAddress);
        if (!userKeypair) {
          console.log('[AutoSellWorker] No userKeypair for:', token.walletAddress);
          return;
        }

        const currentPrice = await getCurrentPrice(connection, token.mint, userKeypair.publicKey);
        if (currentPrice === null || currentPrice === undefined) {
          // console.log('[AutoSellWorker] No currentPrice for:', token.mint);
          return;
        }

        // Only update if price changed
        if (token.currentPrice !== currentPrice) {
          console.log('[AutoSellWorker] Price changed for', token.mint, 'from', token.currentPrice, 'to', currentPrice);

          // Update the UserToken document itself
          const updateResult = await UserToken.updateOne(
            { _id: token._id }, // Use the unique _id to update the correct document
            { $set: { currentPrice: currentPrice, lastUpdated: new Date() } }
          );

          if (updateResult.modifiedCount > 0) {
            console.log('[AutoSellWorker] UserToken update SUCCESS for mint:', token.mint);
          } else {
            console.log('[AutoSellWorker] UserToken update FAILED or no change for mint:', token.mint);
          }

          // Send price update to frontend
          const ws = getOrCreateWebSocket();
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "TOKEN_PRICE_UPDATE",
              mint: token.mint,
              price: currentPrice,
              walletAddress: token.walletAddress,
            }));
            console.log('[AutoSellWorker] Sent TOKEN_PRICE_UPDATE for', token.mint, currentPrice);
          }
        }
      } catch (e) {
        console.error('[AutoSellWorker] Batch price sync error for mint', token.mint, ':', e);
      }
    }));
    if (i + BATCH_SIZE < userTokens.length) {
      await new Promise(res => setTimeout(res, 2000)); // 2s delay between batches
    }
  }
}

let autoSellWorkerActive = false;

export function startAutoSellWorker() {
  console.log('🚀 AutoSell worker started');
  autoSellWorkerActive = true;
  const runWorker = async () => {
    if (!autoSellWorkerActive) return;
    try {
      await checkAndExecuteAllAutoSells();
      await batchPriceSync();
    } catch (e) {
      console.error('[AutoSellWorker] Worker error:', e);
    }
    setTimeout(runWorker, 5000);
  };
  runWorker();
}

export function stopAutoSellWorker() {
  autoSellWorkerActive = false;
  console.log('🛑 AutoSell worker stopped');
}

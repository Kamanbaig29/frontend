import dotenv from 'dotenv';
dotenv.config();

import AutoSell from '../models/autoSell';
import { getCurrentPrice } from './getCurrentPrice';
import { getConnection } from '../utils/getProvider';
import { getUserKeypairByWallet } from '../utils/userWallet';
import WebSocket from 'ws';
import { UserToken } from '../models/userToken'; // Added import for UserToken

let autoSellWorkerInterval: NodeJS.Timeout | null = null;
let ws: WebSocket | null = null;

//const apiLink = process.env.API_LINK;
const wslink = process.env.WS_LINK;
const port = process.env.API_PORT;

// --- WebSocket Setup ---
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

export async function checkAndExecuteAllAutoSells() {
  const autoSells = await AutoSell.find({ autoSellEnabled: true });
  console.log('[AutoSellWorker] checkAndExecuteAllAutoSells, active:', autoSells.length);
  const connection = getConnection();

  for (const config of autoSells) {
    try {
      // Get userKeypair for price fetch
      const userKeypair = await getUserKeypairByWallet(config.walletAddress);
      if (!userKeypair) continue;

      // Get current price and calculate P/L
      const currentPrice = await getCurrentPrice(connection, config.mint, userKeypair.publicKey);
      const buyPrice = config.buyPrice;
      if (!buyPrice || !currentPrice) continue;
      const profitLossPercent = ((currentPrice - buyPrice) / buyPrice) * 100;

      // Check takeProfit/stopLoss
      let shouldSell = false;
      if (typeof config.takeProfit === 'number' && profitLossPercent >= config.takeProfit) {
        shouldSell = true;
      }
      if (typeof config.stopLoss === 'number' && profitLossPercent <= -Math.abs(config.stopLoss)) {
        shouldSell = true;
      }

      if (shouldSell) {
        console.log(
          `🔔 AutoSell triggered for user: ${config.userId}, token: ${config.mint}, P/L: ${profitLossPercent.toFixed(2)}%`
        );
        
        // Send auto-sell notification to frontend
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "AUTO_SELL_TRIGGERED",
            mint: config.mint,
            walletAddress: config.walletAddress,
            percent: config.autoSellPercent,
            profitLoss: profitLossPercent,
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
          isAutoSell: true, // Add flag to identify auto-sells
        });
        // Immediately disable autoSellEnabled to prevent repeated sells
        await AutoSell.updateOne(
          { mint: config.mint, walletAddress: config.walletAddress },
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

        // REMOVE THIS: Don't send SOL balance update here - wait for actual sell transaction
        // The balance update will be sent by the manual sell handler after transaction confirmation
      }
    } catch (err) {
      console.error('AutoSell worker error:', err);
    }
  }
}

async function batchPriceSync() {
  // Fetch all user tokens instead of auto-sell configs
  const userTokens = await UserToken.find({});
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

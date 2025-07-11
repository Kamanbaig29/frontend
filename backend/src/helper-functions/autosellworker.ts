import dotenv from 'dotenv';
dotenv.config();

import AutoSell from '../models/autoSell';
import { getCurrentPrice } from './getCurrentPrice';
import { getConnection } from '../utils/getProvider';
import { getUserKeypairByWallet } from '../utils/userWallet';
import WebSocket from 'ws';

let autoSellWorkerInterval: NodeJS.Timeout | null = null;
let ws: WebSocket | null = null;

const apiLink = process.env.API_LINK;
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

export function startAutoSellWorker() {
  console.log('🚀 AutoSell worker started');
  autoSellWorkerInterval = setInterval(checkAndExecuteAllAutoSells, 5000);
}

export function stopAutoSellWorker() {
  if (autoSellWorkerInterval) {
    clearInterval(autoSellWorkerInterval);
    autoSellWorkerInterval = null;
    console.log('🛑 AutoSell worker stopped');
  }
}

import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { WalletToken } from "../models/WalletToken";
import { AutoSell } from "../models/autoSell";
import { sellToken } from "../action/sell";
import { getSwapAccounts } from "../action/getSwapAccounts";
import { getCurrentPrice } from "./getCurrentPrice";
import { updateOrRemoveTokenAfterSell } from "./db-buy-sell-enterer";
import { getUserKeypairByWallet } from "../utils/userWallet";
import UserPreset from '../models/userPreset';
import User from '../models/user_auth';

// --- CONFIG & UTILS ---
const MEMEHOME_PROGRAM_ID = new PublicKey(process.env.MEMEHOME_PROGRAM_ID!);

// Track which tokens are being processed to avoid double-sell
const processingSells = new Set<string>();

// --- GLOBAL AUTO-SELL WORKER ---
export async function checkAndExecuteAllAutoSells(connection: Connection) {
  //const cycleStart = new Date();
  //console.log(`[AUTO-SELL][GLOBAL] 🚦 Auto-sell global worker cycle started at ${cycleStart.toISOString()}`);

  try {
    // Get all enabled auto-sell configs for all users
    const configsToSell = await AutoSell.find({ autoSellEnabled: true });

    if (configsToSell.length === 0) {
      //console.log(`[AUTO-SELL][GLOBAL] No auto-sell configs enabled in this cycle.`);
    }

    for (const config of configsToSell) {
      const { mint, userPublicKey, buyPrice, takeProfitPercent, stopLossPercent, sellPercentage, slippage, priorityFee, bribeAmount } = config;
      const key = `${mint}_${userPublicKey}`;
      if (processingSells.has(key)) continue;
      processingSells.add(key);

      try {
        // Log config being processed
        console.log(`\n[AUTO-SELL][${userPublicKey}] --- Processing token: ${mint} ---`);
        console.log(`[AUTO-SELL][${userPublicKey}] Config:`, {
          buyPrice, takeProfitPercent, stopLossPercent, sellPercentage
        });

        const token = await WalletToken.findOne({ mint, userPublicKey });
        if (!token) {
          console.log(`[AUTO-SELL][${userPublicKey}] No wallet token found for mint ${mint}, skipping.`);
          continue;
        }

        let userKeypair: Keypair;
        try {
          userKeypair = await getUserKeypairByWallet(userPublicKey);
        } catch (e) {
          console.error(`[AUTO-SELL][${userPublicKey}] ❌ Could not get keypair:`, e);
          continue;
        }

        const currentPrice = await getCurrentPrice(connection, mint, userKeypair.publicKey);
        const buyPriceNum = Number(buyPrice) || 0;
        if (!buyPriceNum || !currentPrice) {
          console.log(`[AUTO-SELL][${userPublicKey}] Missing buyPrice or currentPrice for ${mint}, skipping.`);
          continue;
        }

        // Calculate profit/loss
        const profitLossPercent = ((currentPrice - buyPriceNum) / buyPriceNum) * 100;
        console.log(`[AUTO-SELL][${userPublicKey}] buyPrice: ${buyPriceNum}, currentPrice: ${currentPrice}`);
        console.log(`[AUTO-SELL][${userPublicKey}] Profit/Loss: ${profitLossPercent.toFixed(2)}%`);

        const takeProfitPrice = buyPriceNum * (1 + (Number(takeProfitPercent) || 0) / 100);
        const stopLossPrice = buyPriceNum * (1 - (Number(stopLossPercent) || 0) / 100);

        console.log(`[AUTO-SELL][${userPublicKey}] takeProfitPrice: ${takeProfitPrice}, stopLossPrice: ${stopLossPrice}`);

        let shouldSell = false;
        let reason = "";

        if (takeProfitPercent > 0 && currentPrice >= takeProfitPrice) {
          shouldSell = true;
          reason = "Take Profit";
        } else if (stopLossPercent > 0 && currentPrice <= stopLossPrice) {
          shouldSell = true;
          reason = "Stop Loss";
        }

        if (shouldSell) {
          console.log(`[AUTO-SELL][${userPublicKey}] 🎯 Sell triggered for ${mint} due to ${reason}.`);

          const tokenAmount = parseFloat(token.amount);
          const decimals = token.decimals || 6;
          const sellAmount = (tokenAmount * (Number(sellPercentage) || 100)) / 100;
          const remainingAmount = tokenAmount - sellAmount;
          const sellAmountInSmallestUnit = Math.round(sellAmount * Math.pow(10, decimals));

          console.log(`[AUTO-SELL][${userPublicKey}] tokenAmount: ${tokenAmount}, decimals: ${decimals}`);
          console.log(`[AUTO-SELL][${userPublicKey}] sellAmount: ${sellAmount}, sellAmountInSmallestUnit: ${sellAmountInSmallestUnit}`);
          console.log(`[AUTO-SELL][${userPublicKey}] remainingAmount: ${remainingAmount}`);

          if (sellAmountInSmallestUnit > 0) {
            // 1. Get userId from userPublicKey (if not in config)
            const user = await User.findOne({ walletAddress: userPublicKey });
            const userId = user?._id;

            // 2. Get user's active sell preset
            const userPreset = await UserPreset.findOne({ userId });
            const activeSellPreset = (userPreset?.sellPresets?.[userPreset.activeSellPreset] || {}) as {
              slippage?: number;
              priorityFee?: number;
              bribeAmount?: number;
            };

            console.log(`[AUTO-SELL][${userPublicKey}] activeSellPreset object:`, activeSellPreset);

            if (
              activeSellPreset.slippage === undefined ||
              activeSellPreset.priorityFee === undefined ||
              activeSellPreset.bribeAmount === undefined
            ) {
              console.warn(`[AUTO-SELL][${userPublicKey}] WARNING: activeSellPreset is missing fee fields, using defaults!`, activeSellPreset);
            }

            const swapAccounts = await getSwapAccounts({
              mintAddress: mint,
              buyer: userKeypair.publicKey,
              connection,
              programId: MEMEHOME_PROGRAM_ID,
            });

            // 3. Log the fee parameters before selling
            console.log(`[AUTO-SELL][${userPublicKey}] Using sell params for ${mint}:`);
            console.log(`  Slippage: ${Number(activeSellPreset.slippage) || 5}`);
            console.log(`  Priority Fee: ${Number(activeSellPreset.priorityFee) || 0.001}`);
            console.log(`  Bribe Amount: ${Number(activeSellPreset.bribeAmount) || 0}`);

            // 4. Use these in sellToken
            const txSignature = await sellToken({
              connection,
              userKeypair,
              programId: MEMEHOME_PROGRAM_ID,
              amount: BigInt(sellAmountInSmallestUnit),
              minOut: BigInt(1),
              swapAccounts,
              slippage: Number(activeSellPreset.slippage) || 5,
              priorityFee: Number(activeSellPreset.priorityFee) || 0.001,
              bribeAmount: Number(activeSellPreset.bribeAmount) || 0,
            });

            if (txSignature) {
              console.log(`[AUTO-SELL][${userPublicKey}] ✅ Sold ${sellAmount} of ${mint}. Tx: ${txSignature}`);
              await updateOrRemoveTokenAfterSell({ mint, userPublicKey, remainingAmount: remainingAmount.toString() });
              await AutoSell.updateOne({ mint, userPublicKey }, { $set: { autoSellEnabled: false } });
            } else {
              console.error(`[AUTO-SELL][${userPublicKey}] ❌ Sell transaction failed for ${mint}.`);
            }
          } else {
            console.log(`[AUTO-SELL][${userPublicKey}] Sell amount too small for ${mint}, skipping.`);
          }
        } else {
          console.log(`[AUTO-SELL][${userPublicKey}] No sell condition met for ${mint}.`);
        }
      } catch (error) {
        console.error(`[AUTO-SELL][${userPublicKey}] ❌ Error processing ${mint}:`, error);
      } finally {
        processingSells.delete(key);
      }
    }
  } catch (error) {
    console.error(`[AUTO-SELL][GLOBAL] ❌ Error in main sell check loop:`, error);
  }

  //const cycleEnd = new Date();
  //console.log(`[AUTO-SELL][GLOBAL] 🏁 Auto-sell global worker cycle ended at ${cycleEnd.toISOString()}`);
}


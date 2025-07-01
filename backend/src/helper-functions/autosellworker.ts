import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { WalletToken } from "../models/WalletToken";
import { AutoSell } from "../models/autoSell";
import { sellToken } from "../action/sell";
import { getSwapAccounts } from "../action/getSwapAccounts";
import { getCurrentPrice } from "./getCurrentPrice";
import { updateOrRemoveTokenAfterSell } from "./db-buy-sell-enterer";
import { getUserKeypairByWallet } from "../utils/userWallet";

// --- CONFIG & UTILS ---
const MEMEHOME_PROGRAM_ID = new PublicKey(process.env.MEMEHOME_PROGRAM_ID!);

// Track which tokens are being processed to avoid double-sell
const processingSells = new Set<string>();

// --- SYNC FUNCTION ---
async function syncWalletToAutoSell(userPublicKey: PublicKey) {
  const startTime = Date.now();
  try {
    const allWalletTokens = await WalletToken.find({ userPublicKey: userPublicKey.toBase58() });

    for (const token of allWalletTokens) {
      const { mint, userPublicKey, buyPrice } = token;

      await AutoSell.findOneAndUpdate(
        { mint, userPublicKey },
        {
          $set: { buyPrice },
          $setOnInsert: {
            mint,
            userPublicKey
          }
        },
        { upsert: true, new: true }
      );
    }
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`[SYNC] ✅ Sync cycle completed in ${duration}s for user ${userPublicKey.toBase58()}.`);
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[SYNC] ❌ Error after ${duration}s:`, error);
  }
}

// --- AUTO-SELL LOGIC ---
async function checkAndExecuteAutoSells(connection: Connection, userPublicKey: PublicKey) {
  try {
    const configsToSell = await AutoSell.find({ autoSellEnabled: true, userPublicKey: userPublicKey.toBase58() });

    for (const config of configsToSell) {
      const key = `${config.mint}_${config.userPublicKey}`;
      if (processingSells.has(key)) {
        continue;
      }

      processingSells.add(key);

      try {
        const { mint, userPublicKey, buyPrice, takeProfitPercent, stopLossPercent, sellPercentage, slippage, priorityFee, bribeAmount } = config;

        // DB se latest token info lo
        const token = await WalletToken.findOne({ mint, userPublicKey });
        if (!token) {
          continue;
        }

        // --- DYNAMIC: Get user keypair for this user ---
        let userKeypair: Keypair;
        try {
          userKeypair = await getUserKeypairByWallet(token.userPublicKey);
        } catch (e) {
          console.error(`[AUTO-SELL] ❌ Could not get keypair for user ${token.userPublicKey}:`, e);
          continue;
        }

        // Use dynamic keypair for price
        const currentPrice = await getCurrentPrice(connection, mint, userKeypair.publicKey);
        const buyPriceNum = Number(buyPrice) || 0;
        if (!buyPriceNum || !currentPrice) {
          continue;
        }

        // Profit/loss calculate karo
        const takeProfitPrice = buyPriceNum * (1 + (Number(takeProfitPercent) || 0) / 100);
        const stopLossPrice = buyPriceNum * (1 - (Number(stopLossPercent) || 0) / 100);

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
          console.log(`[AUTO-SELL][${userPublicKey}] 🎯 Triggered for ${mint} due to ${reason}.`);

          const tokenAmount = parseFloat(token.amount);
          const decimals = token.decimals || 6;
          const sellAmount = (tokenAmount * (Number(sellPercentage) || 100)) / 100;
          const remainingAmount = tokenAmount - sellAmount;
          const sellAmountInSmallestUnit = Math.round(sellAmount * Math.pow(10, decimals));

          if (sellAmountInSmallestUnit > 0) {
            const swapAccounts = await getSwapAccounts({
              mintAddress: mint,
              buyer: userKeypair.publicKey,
              connection,
              programId: MEMEHOME_PROGRAM_ID,
            });

            const txSignature = await sellToken({
              connection,
              userKeypair,
              programId: MEMEHOME_PROGRAM_ID,
              amount: BigInt(sellAmountInSmallestUnit),
              minOut: BigInt(1),
              swapAccounts,
              slippage: Number(slippage) || 5,
              priorityFee: Number(priorityFee) || 0.001,
              bribeAmount: Number(bribeAmount) || 0,
            });

            if (txSignature) {
              console.log(`[AUTO-SELL][${userPublicKey}] ✅ Sold ${sellAmount} of ${mint}. Tx: ${txSignature}`);
              await updateOrRemoveTokenAfterSell({ mint, userPublicKey, remainingAmount: remainingAmount.toString() });
              await AutoSell.updateOne({ mint, userPublicKey }, { $set: { autoSellEnabled: false } });
            }
          }
        }
      } catch (error) {
        console.error(`[AUTO-SELL][${userPublicKey.toBase58()}] ❌ Error processing ${config.mint}:`, error);
      } finally {
        processingSells.delete(key);
      }
    }
  } catch (error) {
    console.error(`[AUTO-SELL][${userPublicKey.toBase58()}] ❌ Error in main sell check loop:`, error);
  }
}

// --- GLOBAL AUTO-SELL WORKER ---
export async function checkAndExecuteAllAutoSells(connection: Connection) {
  const cycleStart = new Date();
  console.log(`[AUTO-SELL][GLOBAL] 🚦 Auto-sell global worker cycle started at ${cycleStart.toISOString()}`);

  try {
    // Get all enabled auto-sell configs for all users
    const configsToSell = await AutoSell.find({ autoSellEnabled: true });

    if (configsToSell.length === 0) {
      console.log(`[AUTO-SELL][GLOBAL] No auto-sell configs enabled in this cycle.`);
    }

    for (const config of configsToSell) {
      const { mint, userPublicKey, buyPrice, takeProfitPercent, stopLossPercent, sellPercentage, slippage, priorityFee, bribeAmount } = config;
      const key = `${mint}_${userPublicKey}`;
      if (processingSells.has(key)) continue;
      processingSells.add(key);

      try {
        // Log which user/token is being checked
        console.log(`[AUTO-SELL][${userPublicKey}] Checking token ${mint} for auto-sell conditions...`);

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

        const takeProfitPrice = buyPriceNum * (1 + (Number(takeProfitPercent) || 0) / 100);
        const stopLossPrice = buyPriceNum * (1 - (Number(stopLossPercent) || 0) / 100);

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
          console.log(`[AUTO-SELL][${userPublicKey}] 🎯 Triggered for ${mint} due to ${reason}.`);

          const tokenAmount = parseFloat(token.amount);
          const decimals = token.decimals || 6;
          const sellAmount = (tokenAmount * (Number(sellPercentage) || 100)) / 100;
          const remainingAmount = tokenAmount - sellAmount;
          const sellAmountInSmallestUnit = Math.round(sellAmount * Math.pow(10, decimals));

          if (sellAmountInSmallestUnit > 0) {
            const swapAccounts = await getSwapAccounts({
              mintAddress: mint,
              buyer: userKeypair.publicKey,
              connection,
              programId: MEMEHOME_PROGRAM_ID,
            });

            const txSignature = await sellToken({
              connection,
              userKeypair,
              programId: MEMEHOME_PROGRAM_ID,
              amount: BigInt(sellAmountInSmallestUnit),
              minOut: BigInt(1),
              swapAccounts,
              slippage: Number(slippage) || 5,
              priorityFee: Number(priorityFee) || 0.001,
              bribeAmount: Number(bribeAmount) || 0,
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

  const cycleEnd = new Date();
  console.log(`[AUTO-SELL][GLOBAL] 🏁 Auto-sell global worker cycle ended at ${cycleEnd.toISOString()}`);
}


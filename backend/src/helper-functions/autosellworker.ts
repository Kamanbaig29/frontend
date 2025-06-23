import mongoose from "mongoose";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { WalletToken } from "../models/WalletToken";
import { AutoSell } from "../models/autoSell";
import { sellToken } from "../action/sell";
import { getSwapAccounts } from "../action/getSwapAccounts";
import { getCurrentPrice } from "./getCurrentPrice";
import { RPC_ENDPOINT } from "../config/test-config";

const MEMEHOME_PROGRAM_ID = new PublicKey(process.env.MEMEHOME_PROGRAM_ID!);
const secretKeyString = process.env.USER_SECRET_KEY!;
const secretKeyArray: number[] = JSON.parse(secretKeyString);
const userKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
const connection = new Connection(RPC_ENDPOINT);
const monitored = new Set<string>(); // mint_userPublicKey as unique key

// Helper: Check if config is valid for autosell
function isValidAutoSellConfig(cfg: any) {
  return cfg.autoSellEnabled && (cfg.takeProfitPercent || cfg.stopLossPercent);
}

// Main loop for each token
async function monitorAndSell(config: any) {
  const { mint, userPublicKey, buyPrice, takeProfitPercent, stopLossPercent, sellPercentage, slippage, priorityFee, bribeAmount } = config;

  while (true) {
    try {
      // Get latest token info from DB
      const token = await WalletToken.findOne({ mint, userPublicKey });
      if (!token) {
        await new Promise(res => setTimeout(res, 2000));
        continue;
      }

      // Get current price using your provided function
      const currentPrice = await getCurrentPrice(connection, mint);
      const buyPriceNum = Number(buyPrice) || 0;
      if (!buyPriceNum || !currentPrice) {
        await new Promise(res => setTimeout(res, 5000));
        continue;
      }

      // Calculate profit/loss
      const takeProfitPrice = buyPriceNum * (1 + (Number(takeProfitPercent) || 0) / 100);
      const stopLossPrice = buyPriceNum * (1 - (Number(stopLossPercent) || 0) / 100);

      let shouldSell = false;
      let reason = "";
      if (takeProfitPercent && currentPrice >= takeProfitPrice) {
        shouldSell = true;
        reason = "Take Profit";
      } else if (stopLossPercent && currentPrice <= stopLossPrice) {
        shouldSell = true;
        reason = "Stop Loss";
      }

      if (shouldSell) {
        // Calculate amount to sell
        const tokenAmount = parseFloat(token.amount);
        const decimals = token.decimals || 6;
        const sellAmount = (tokenAmount * (Number(sellPercentage) || 100)) / 100;
        const sellAmountInSmallestUnit = Math.round(sellAmount * Math.pow(10, decimals));
        if (sellAmountInSmallestUnit > 0) {
          const swapAccounts = await getSwapAccounts({
            mintAddress: mint,
            buyer: userKeypair.publicKey,
            connection,
            programId: MEMEHOME_PROGRAM_ID,
          });
          try {
            const txSignature = await sellToken({
              connection,
              userKeypair,
              programId: MEMEHOME_PROGRAM_ID,
              amount: BigInt(sellAmountInSmallestUnit),
              minOut: BigInt(1),
              swapAccounts,
              slippage: Number(slippage) || 0,
              priorityFee: Number(priorityFee) || 0,
              bribeAmount: Number(bribeAmount) || 0,
            });
            if (txSignature) {
              token.amount = (tokenAmount - sellAmount).toString();
              await token.save();

              // AutoSell config ko disable kar dein
              await AutoSell.updateOne(
                { mint, userPublicKey },
                { $set: { autoSellEnabled: false } }
              );

              console.log(`✅ [${reason}] Sold ${sellAmount} tokens of ${mint} at price ${currentPrice}. Tx: ${txSignature}`);
              break; // Stop monitoring after sell
            }
          } catch (err) {
            console.error(`❌ Auto-sell failed for ${mint}:`, err);
          }
        }
      }
    } catch (err) {
      console.error(`❌ Error in monitorAndSell for ${config.mint}:`, err);
    }
    // Wait 2 seconds before next check
    await new Promise(res => setTimeout(res, 2000));
  }
}

// Main entry: scan all configs and start monitor for each
export async function startAutoSellWorker() {
  setInterval(async () => {
    const configs = await AutoSell.find({});
    const validConfigs = configs.filter(isValidAutoSellConfig);

    for (const config of validConfigs) {
      const key = `${config.mint}_${config.userPublicKey}`;
      if (!monitored.has(key)) {
        monitored.add(key);
        monitorAndSell(config);
      }
    }
  }, 20000); // 10 seconds

  console.log("🔁 Auto-sell worker interval started (every 10s).");
}
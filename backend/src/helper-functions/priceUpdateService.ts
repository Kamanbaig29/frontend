import { WalletToken } from '../models/WalletToken';
import { TokenPrice } from '../models/TokenPrice';
import { getConnection } from '../utils/getProvider';
import { getCurrentPrice } from './getCurrentPrice';
import { PublicKey, Connection } from '@solana/web3.js';


// Helper function for delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));



// Batch price updater with wallet token sync
async function updatePrices(connection: Connection, userPublicKey: PublicKey) {
  const startTime = Date.now();
  
  try {
    // Get all unique mints for this user
    const walletTokens = await WalletToken.find({ userPublicKey: userPublicKey.toBase58() });
    const BATCH_SIZE = 3;
    const DELAY_BETWEEN_BATCHES = 3000;

    console.log(`🔄 Starting price update for ${walletTokens.length} tokens for user ${userPublicKey.toBase58()}`);

    for (let i = 0; i < walletTokens.length; i += BATCH_SIZE) {
      const batch = walletTokens.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (walletToken) => {
        try {
          const mint = walletToken.mint;
          const currentPrice = await getCurrentPrice(connection, mint, userPublicKey);
          
          if (currentPrice > 0) {
            const buyPrice = walletToken.buyPrice || 0;
            
            // Update TokenPrice with current price and buy price from wallet
            await TokenPrice.findOneAndUpdate(
              { mint, userPublicKey: userPublicKey.toBase58() },
              { $set: { mint, currentPrice, buyPrice, lastUpdated: new Date(), userPublicKey: userPublicKey.toBase58() } },
              { upsert: true }
            );
            
            //console.log(`✅ TokenPrice updated for ${mint}: Current=${currentPrice}, Buy=${buyPrice}`);
          }
        } catch (error) {
          console.error(`❌ Error updating price for mint ${walletToken.mint}:`, error);
        }
      }));

      if (i + BATCH_SIZE < walletTokens.length) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }
    
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    console.log(`⏱️ Price update cycle completed in ${totalTime.toFixed(2)} seconds for user ${userPublicKey.toBase58()}`);
    
  } catch (error) {
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    console.error(`❌ Error in price update cycle after ${totalTime.toFixed(2)} seconds:`, error);
  }
}

// Start the price update service for a specific user
export function startPriceUpdateService(connection: Connection, userPublicKey: PublicKey, interval: number = 5 * 60 * 1000) {
  console.log(`🚀 Price update service started for user ${userPublicKey.toBase58()} with ${interval / 1000 / 60} minute interval`);
  let stopped = false;
  let timeoutId: NodeJS.Timeout;

  const run = async () => {
    if (stopped) return;
    
    console.log(`🔄 Starting price update cycle at ${new Date().toLocaleTimeString()} for user ${userPublicKey.toBase58()}`);
    
    try {
      await updatePrices(connection, userPublicKey);
      console.log(`✅ Price update cycle completed at ${new Date().toLocaleTimeString()} for user ${userPublicKey.toBase58()}`);
    } catch (error) {
      console.error(`❌ Error in price update cycle:`, error);
    }
    
    if (!stopped) {
      timeoutId = setTimeout(run, interval);
    }
  };

  run();

  return () => {
    stopped = true;
    clearTimeout(timeoutId);
    console.log(`⏹️ Price update service stopped for user ${userPublicKey.toBase58()}`);
  };
}
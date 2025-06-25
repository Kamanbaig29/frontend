import { WalletToken } from '../models/WalletToken';
import { TokenPrice } from '../models/TokenPrice';
import { getConnection } from '../utils/getProvider';
import { getCurrentPrice } from './getCurrentPrice';


// Helper function for delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));



// Batch price updater with wallet token sync
async function updatePrices() {
  const connection = getConnection();
  const startTime = Date.now();
  
  try {
    // Get all unique mints from WalletToken collection
    const walletTokens = await WalletToken.distinct('mint');
    const BATCH_SIZE = 3;
    const DELAY_BETWEEN_BATCHES = 3000;

    console.log(`🔄 Starting price update for ${walletTokens.length} tokens`);

    for (let i = 0; i < walletTokens.length; i += BATCH_SIZE) {
      const batch = walletTokens.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (mint) => {
        try {
          // Get current price
          const currentPrice = await getCurrentPrice(connection, mint);
          
          if (currentPrice > 0) {
            // Get buy price from WalletToken for this mint
            const walletToken = await WalletToken.findOne({ mint });
            const buyPrice = walletToken?.buyPrice || 0;
            
            // Update TokenPrice with current price and buy price from wallet
            await TokenPrice.findOneAndUpdate(
              { mint },
              { $set: { mint, currentPrice, buyPrice, lastUpdated: new Date() } },
              { upsert: true }
            );
            
            //console.log(`✅ TokenPrice updated for ${mint}: Current=${currentPrice}, Buy=${buyPrice}`);
          }
        } catch (error) {
          console.error(`❌ Error updating price for mint ${mint}:`, error);
        }
      }));

      if (i + BATCH_SIZE < walletTokens.length) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }
    
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    console.log(`⏱️ Price update cycle completed in ${totalTime.toFixed(2)} seconds`);
    
  } catch (error) {
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    console.error(`❌ Error in price update cycle after ${totalTime.toFixed(2)} seconds:`, error);
  }
}

// Start the price update service with 5 minute interval
export function startPriceUpdateService(interval: number = 5 * 60 * 1000) {
  console.log(`🚀 Price update service started with ${interval / 1000 / 60} minute interval`);
  let stopped = false;
  let timeoutId: NodeJS.Timeout;

  const run = async () => {
    if (stopped) return;
    
    console.log(`🔄 Starting price update cycle at ${new Date().toLocaleTimeString()}`);
    
    try {
      await updatePrices();
      console.log(`✅ Price update cycle completed at ${new Date().toLocaleTimeString()}`);
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
    console.log("⏹️ Price update service stopped");
  };
}
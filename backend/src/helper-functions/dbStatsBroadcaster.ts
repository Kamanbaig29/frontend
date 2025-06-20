import { WalletToken } from '../models/WalletToken';
import { TokenPrice } from '../models/TokenPrice';
import { broadcastUpdate } from '../helper-functions/runner_functions'; // ya jahan se bhi aapka broadcastUpdate hai
import { wss } from '../trade-bot/tokenListner'; // ya jahan se bhi aapka wss instance hai

async function broadcastStatsToFrontend() {
  // Yahan pe aap apne wallet address ya filter laga sakte hain
  const tokens = await WalletToken.find({});
  const tokenPrices = await TokenPrice.find({ mint: { $in: tokens.map(t => t.mint) } });

  // tokensWithPrices build karo (jaise GET_STATS
  const priceMap = new Map(tokenPrices.map(tp => [tp.mint, tp]));
  const tokensWithPrices = tokens.map(token => {
    const priceEntry = priceMap.get(token.mint);
    const currentPrice = priceEntry?.currentPrice ?? 0;
    const buyPrice = token.buyPrice ?? 0;
    const profitLossPercent =
      buyPrice > 0
        ? Number((((currentPrice - buyPrice) / buyPrice) * 100).toFixed(2))
        : 0;
    return {
      ...token.toObject(),
      currentPrice,
      profitLossPercent,
    };
  });

  broadcastUpdate(wss, {
    type: "STATS_DATA",
    data: { walletTokens: tokensWithPrices }
  });
}

// Infinite polling loop
export function startDbStatsBroadcaster(interval = 1000) {
  setInterval(broadcastStatsToFrontend, interval);
}

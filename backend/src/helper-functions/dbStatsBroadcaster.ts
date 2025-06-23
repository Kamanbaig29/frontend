import { WalletToken } from '../models/WalletToken';
import { AutoSell } from '../models/autoSell';
import { TokenPrice } from '../models/TokenPrice';
import { broadcastUpdate, wss } from '../trade-bot/tokenListner';

// Send paginated stats on demand
export async function sendFullStatsToClient(ws: any, page: number = 1, pageSize: number = 10) {
  const walletAddress = process.env.BUYER_PUBLIC_KEY;
  const skip = (page - 1) * pageSize;

  // Paginated tokens
  const tokens = await WalletToken.find({ userPublicKey: walletAddress })
    .skip(skip)
    .limit(pageSize);

  const totalTokens = await WalletToken.countDocuments({ userPublicKey: walletAddress });
  const autoSellConfigs = await AutoSell.find({ userPublicKey: walletAddress });
  const tokenPrices = await TokenPrice.find({ mint: { $in: tokens.map(t => t.mint) } });

  // Attach currentPrice and profitLossPercent to each wallet token
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

  ws.send(JSON.stringify({
    type: "STATS_DATA",
    data: {
      walletTokens: tokensWithPrices,
      autoSellConfigs,
      tokenPrices,
      page,
      pageSize,
      totalTokens
    }
  }));
}

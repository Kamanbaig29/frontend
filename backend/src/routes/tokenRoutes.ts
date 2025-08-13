import { Router } from 'express';
import { Request, Response } from 'express';
import { MemeHomeToken } from '../models/MemeHomeToken';
import { PumpFunToken } from '../models/PumpFunToken';
import { authenticateJWT } from '../middleware/authMiddleware';
import { getBuyersCount } from '../helper-functions/getBuyersCount';

const router = Router();

// Protected route - requires authentication
router.get('/all', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch only PumpFun tokens
    const pumpFunTokens = await PumpFunToken.find({}).sort({ 'metadata.createdAt': -1 });
    
    // Transform PumpFun tokens to match frontend Token interface
    const transformedPumpFunTokens = pumpFunTokens.map(token => ({
      mint: token.metadata.mint,
      name: token.metadata.name,
      symbol: token.metadata.symbol,
      imageUrl: token.metadata.image,
      creationTimestamp: new Date(token.metadata.createdAt).getTime(),
      currentPrice: token.tokenAnalytics.priceNative,
      creator: token.metadata.creator,
      // Add additional fields from PumpFun data
      marketCap: token.tokenAnalytics.marketCap,
      volume: token.tokenAnalytics.volume,
      holders: token.holderStats.totalHolders,
      buys: token.tokenAnalytics.buys,
      sells: token.tokenAnalytics.sells,
      bondingCurveProgress: token.bondingCurveProgress.bondingCurveProgress,
      website: token.metadata.website,
      twitter: token.metadata.twitter,
      telegram: token.metadata.telegram,
      pumpLink: token.metadata.pumpLink
    }));
    
    // Sort tokens by creation timestamp
    const allTokens = transformedPumpFunTokens
      .sort((a, b) => b.creationTimestamp - a.creationTimestamp);
    
    res.json({ tokens: transformedPumpFunTokens });
  } catch (err) {
    console.error('Error fetching tokens:', err);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// Public endpoint to get metrics for a token by mint
router.get('/:mint/metrics', async (req: Request<{ mint: string }>, res: Response): Promise<void> => {
  const { mint } = req.params;
  try {
    const token = await MemeHomeToken.findOne({ mint });
    if (!token) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }
    
    const buyersCount = await getBuyersCount(mint);
    res.json({
      marketCap: token.marketCap ?? null,
      marketCapUsd: token.marketCapUsd ?? null,
      buyersCount
    });
  } catch (err) {
    console.error('Error fetching token metrics:', err);
    res.status(500).json({ error: 'Failed to fetch token metrics' });
  }
});

export default router;
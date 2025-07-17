import { Router } from 'express';
import { Request, Response } from 'express';
import { MemeHomeToken } from '../models/MemeHomeToken';
import { authenticateJWT } from '../middleware/authMiddleware';
import { getBuyersCount } from '../helper-functions/getBuyersCount';

const router = Router();

// Protected route - requires authentication
router.get('/all', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const tokens = await MemeHomeToken.find({}).sort({ creationTimestamp: -1 });
    res.json({ tokens });
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
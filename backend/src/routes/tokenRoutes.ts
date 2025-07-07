import { Router } from 'express';
import { MemeHomeToken } from '../models/MemeHomeToken';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Protected route - requires authentication
router.get('/all', authenticateJWT, async (req, res) => {
  try {
    const tokens = await MemeHomeToken.find({}).sort({ creationTimestamp: -1 });
    res.json({ tokens });
  } catch (err) {
    console.error('Error fetching tokens:', err);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

export default router;

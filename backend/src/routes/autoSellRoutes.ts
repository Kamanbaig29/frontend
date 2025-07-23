import express, { Request, Response, NextFunction } from 'express';
import AutoSell from '../models/autoSell';

const router = express.Router();

router.post('/upsert', async (req: Request, res: Response, next: NextFunction) => {
  const { userId, mint, walletAddress, ...rest } = req.body;
  
  if (!userId || !mint || !walletAddress) {
    res.status(400).json({ error: 'userId, mint, and walletAddress required' });
    return;
  }

  try {
    // Check if this is a new AutoSell config (not found before)
    let doc = await AutoSell.findOne({ userId, mint });
    let boughtTime = undefined;
    if (!doc) {
      // Try to get buyTime from UserToken
      const userToken = await require('../models/userToken').UserToken.findOne({ userId, mint });
      if (userToken && userToken.buyTime) {
        boughtTime = userToken.buyTime;
      }
    }
    // Upsert with boughtTime if new
    doc = await AutoSell.findOneAndUpdate(
      { userId, mint },
      { $set: { ...rest, userId, mint, walletAddress, ...(boughtTime ? { boughtTime } : {}) } },
      { upsert: true, new: true }
    );
    res.json({ success: true, doc });
  // amazonq-ignore-next-line
  } catch (e) {
    // amazonq-ignore-next-line
    console.error('AutoSell upsert error:', e); // Log the error
    const upsertErrorMessage = e instanceof Error ? e.message : 'Internal server error';
    res.status(500).json({ error: upsertErrorMessage });
  }
});

// NEW: Get all AutoSell configs for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const autoSells = await AutoSell.find({ userId });
    res.json({ autoSells });
  } catch (e) {
    console.error('AutoSell fetch error:', e); // Log the errorbreak
    const fetchErrorMessage = e instanceof Error ? e.message : 'Internal server error';
    res.status(500).json({ error: fetchErrorMessage });
  }
});

export default router;
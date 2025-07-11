import express, { Request, Response, NextFunction } from 'express';
import AutoSell from '../models/autoSell';

const router = express.Router();

router.post('/upsert', async (req: Request, res: Response, next: NextFunction) => {
  const { userId, mint, ...rest } = req.body;
  
  if (!userId || !mint) {
    res.status(400).json({ error: 'userId and mint required' });
    return;
  }

  try {
    const doc = await AutoSell.findOneAndUpdate(
      { userId, mint },
      { $set: { ...rest, userId, mint } },
      { upsert: true, new: true }
    );
    res.json({ success: true, doc });
  } catch (e) {
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
    const fetchErrorMessage = e instanceof Error ? e.message : 'Internal server error';
    res.status(500).json({ error: fetchErrorMessage });
  }
});

export default router;
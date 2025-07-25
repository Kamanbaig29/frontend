import express from 'express';

const router = express.Router();

router.get('/sol-price', async (req, res) => {
  try {
    const response = await fetch(process.env.SOL_PRICE_API || 'https://api.coinbase.com/v2/prices/SOL-USD/spot');
    const data: any = await response.json();
    
    res.json({
      price: parseFloat(data.data.amount),
      currency: data.data.currency
    });
  } catch (error) {
    console.error('Failed to fetch SOL price:', error);
    res.status(500).json({ error: 'Failed to fetch SOL price' });
  }
});

export default router;
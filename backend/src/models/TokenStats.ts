import mongoose from 'mongoose';

const tokenStatsSchema = new mongoose.Schema({
  mint: { type: String, required: true, unique: true },
  buyPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  profitLoss: { type: Number, required: true },
  profitPercentage: { type: Number, required: true },
  holdingTime: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['holding', 'selling', 'sold'],
    required: true 
  },
  lastUpdated: { type: Number, required: true }
});

export const TokenStats = mongoose.model('TokenStats', tokenStatsSchema);
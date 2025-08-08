import mongoose from 'mongoose';

const AutoSellSchema = new mongoose.Schema({
  // amazonq-ignore-next-line
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  walletAddress: { type: String, required: true, index: true },
  mint: { type: String, required: true, index: true },
  // amazonq-ignore-next-line
  buyPrice: { type: Number, required: true },
  takeProfit: { type: Number, required: false }, // e.g. 2.5 (SOL) or percent
  takeProfitEnabled: { type: Boolean, default: false },
  stopLoss: { type: Number, required: false },   // e.g. 10 (%)
  stopLossEnabled: { type: Boolean, default: false },
  trailingStopLossPercent: { type: Number, required: false }, // e.g. 5 (%)
  // amazonq-ignore-next-line
  trailingStopLossEnabled: { type: Boolean, default: false },
  timeBasedSellSec: { type: Number, required: false }, // e.g. 60 (seconds)
  timeBasedSellEnabled: { type: Boolean, default: false },
  waitForBuyersBeforeSell: { type: Number, required: false }, // e.g. 5 (buyers)
  waitForBuyersBeforeSellEnabled: { type: Boolean, default: false },
  autoSellPercent: { type: Number, required: true }, // e.g. 100 for full, 50 for half
  autoSellEnabled: { type: Boolean, default: false },
  lastSellTime: { type: Date },
  currentPrice: { type: Number },
  tokenName: { type: String },
  tokenSymbol: { type: String },
  slippage: { type: Number, default: 5 }, // Default 5%
  priorityFee: { type: Number, default: 0.001 }, // Default 0.001 SOL
  bribeAmount: { type: Number, default: 0 }, // Default 0 SOL
  boughtTime: { type: Date }, // Date/time when the token was bought
  peakPrice: { type: Number }, // For trailing stop loss
}, { timestamps: true }); // adds createdAt, updatedAt

AutoSellSchema.index({ userId: 1, mint: 1 }, { unique: true }); // one config per user/token

export default mongoose.model('AutoSell', AutoSellSchema);
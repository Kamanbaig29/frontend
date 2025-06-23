import mongoose, { Schema, Document } from 'mongoose';

export interface IAutoSell extends Document {
  mint: string;
  userPublicKey: string;
  autoSellEnabled: boolean;
  takeProfitPercent: number;
  stopLossPercent: number;
  sellPercentage: number;
  buyPrice: number;
  slippage: number;
  priorityFee: number; // Stored in SOL
  bribeAmount: number; // Stored in SOL
}

const AutoSellSchema: Schema = new Schema({
  mint: { type: String, required: true },
  userPublicKey: { type: String, required: true },
  autoSellEnabled: { type: Boolean, default: false },
  takeProfitPercent: { type: Number, default: 0 },
  stopLossPercent: { type: Number, default: 0 },
  sellPercentage: { type: Number, default: 100 },
  buyPrice: { type: Number, required: true },
  slippage: { type: Number, default: 5 }, // Default 5%
  priorityFee: { type: Number, default: 0.001 }, // Default 0.001 SOL
  bribeAmount: { type: Number, default: 0 }, // Default 0 SOL
});

AutoSellSchema.index({ mint: 1, userPublicKey: 1 }, { unique: true });

export const AutoSell = mongoose.model<IAutoSell>('AutoSell', AutoSellSchema);
import mongoose, { Schema, Document } from 'mongoose';

export interface IMemeHomeToken extends Document {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  //owner: string;
  bondingCurve: string;
  curveTokenAccount: string;
  metadata: string;
  decimals: number;
  supply?: string;
  creationTimestamp: number;
  creationSignature: string;
  currentPrice?: number;
  totalVolume?: number;
  totalTransactions?: number;
  isActive: boolean;
  lastUpdated: Date;
  platform: 'memehome' | 'pumpfun';
  imageUrl?: string;
  metadataUri?: string;
  marketCap?: number;
  marketCapUsd?: number;
}

const MemeHomeTokenSchema: Schema = new Schema({
  mint: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  creator: { type: String, required: true },
  //owner: { type: String, required: false },
  bondingCurve: { type: String, required: true },
  curveTokenAccount: { type: String, required: true },
  metadata: { type: String, required: true },
  decimals: { type: Number, required: true, default: 9 },
  supply: { type: String },
  creationTimestamp: { type: Number, required: true },
  creationSignature: { type: String, required: true },
  currentPrice: { type: Number },
  totalVolume: { type: Number, default: 0 },
  totalTransactions: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  platform: { type: String, enum: ['memehome', 'pumpfun'], default: 'memehome' },
  imageUrl: { type: String },
  metadataUri: { type: String },
  marketCap: { type: Number },
  marketCapUsd: { type: Number },
});

MemeHomeTokenSchema.index({ creationTimestamp: -1 });
MemeHomeTokenSchema.index({ creator: 1 });
MemeHomeTokenSchema.index({ isActive: 1 });
MemeHomeTokenSchema.index({ currentPrice: -1 });
MemeHomeTokenSchema.index({ platform: 1 });
MemeHomeTokenSchema.index({ marketCap: -1 });

export const MemeHomeToken = mongoose.model<IMemeHomeToken>('MemeHomeToken', MemeHomeTokenSchema); 
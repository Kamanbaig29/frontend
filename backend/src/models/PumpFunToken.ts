import mongoose, { Schema, Document } from 'mongoose';

export interface IPumpFunToken extends Document {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  creator: string;
  bondingCurve: string;
  associatedBondingCurve: string;
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
  platform: 'pumpfun';
  imageUrl?: string;
  metadataUri?: string;
  marketCap?: number;
  marketCapUsd?: number;
  virtualTokenReserves?: number;
  virtualSolReserves?: number;
  realTokenReserves?: number;
  complete?: boolean;
}

const PumpFunTokenSchema: Schema = new Schema({
  mint: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  uri: { type: String, required: true },
  creator: { type: String, required: true },
  bondingCurve: { type: String, required: true },
  associatedBondingCurve: { type: String, required: true },
  metadata: { type: String, required: true },
  decimals: { type: Number, required: true, default: 6 },
  supply: { type: String },
  creationTimestamp: { type: Number, required: true },
  creationSignature: { type: String, required: true },
  currentPrice: { type: Number },
  totalVolume: { type: Number, default: 0 },
  totalTransactions: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  platform: { type: String, enum: ['pumpfun'], default: 'pumpfun' },
  imageUrl: { type: String },
  metadataUri: { type: String },
  marketCap: { type: Number },
  marketCapUsd: { type: Number },
  virtualTokenReserves: { type: Number },
  virtualSolReserves: { type: Number },
  realTokenReserves: { type: Number },
  complete: { type: Boolean, default: false },
});

PumpFunTokenSchema.index({ creationTimestamp: -1 });
PumpFunTokenSchema.index({ creator: 1 });
PumpFunTokenSchema.index({ isActive: 1 });
PumpFunTokenSchema.index({ currentPrice: -1 });
PumpFunTokenSchema.index({ marketCap: -1 });
PumpFunTokenSchema.index({ complete: 1 });

export const PumpFunToken = mongoose.model<IPumpFunToken>('PumpFunToken', PumpFunTokenSchema);
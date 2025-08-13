import mongoose, { Schema, Document } from 'mongoose';

export interface IPumpFunToken extends Document {
  metadata: {
    name: string;
    symbol: string;
    description?: string;
    image?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    pumpLink?: string;
    decimal: number;
    totalSupply: number;
    totalSupplyFormatted: string;
    mint: string;
    creator: string;
    createdAt: Date;
    verified?: boolean;
  };
  bondingCurveProgress: {
    bondingCurveProgress: number;
    position?: 'first' | 'last' | 'middle';
  };
  holderStats: {
    totalHolders: number;
    holderChange24h: number;
    holderChangePercent24h: number;
    whales: number;
    sharks: number;
    dolphins: number;
    top10SupplyPercent: number;
  };
  tokenAnalytics: {
    buys: number;
    sells: number;
    totalTransactions: number;
    volume: number;
    priceChange: number;
    marketCap: number;
    priceUsd: number;
    priceNative: number;
  };
}

const PumpFunTokenSchema: Schema = new Schema({
  metadata: {
    name: { type: String, required: true },
    symbol: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    website: { type: String },
    twitter: { type: String },
    telegram: { type: String },
    pumpLink: { type: String },
    decimal: { type: Number, required: true, default: 6 },
    totalSupply: { type: Number, required: true },
    totalSupplyFormatted: { type: String, required: true },
    mint: { type: String, required: true, unique: true },
    creator: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
    verified: { type: Boolean, default: false }
  },
  bondingCurveProgress: {
    bondingCurveProgress: { type: Number, required: true, default: 0 },
    position: { type: String, enum: ['first', 'last', 'middle'] }
  },
  holderStats: {
    totalHolders: { type: Number, default: 0 },
    holderChange24h: { type: Number, default: 0 },
    holderChangePercent24h: { type: Number, default: 0 },
    whales: { type: Number, default: 0 },
    sharks: { type: Number, default: 0 },
    dolphins: { type: Number, default: 0 },
    top10SupplyPercent: { type: Number, default: 0 }
  },
  tokenAnalytics: {
    buys: { type: Number, default: 0 },
    sells: { type: Number, default: 0 },
    totalTransactions: { type: Number, default: 0 },
    volume: { type: Number, default: 0 },
    priceChange: { type: Number, default: 0 },
    marketCap: { type: Number, default: 0 },
    priceUsd: { type: Number, default: 0 },
    priceNative: { type: Number, default: 0 }
  }
});

export const PumpFunToken = mongoose.model<IPumpFunToken>('PumpFunToken', PumpFunTokenSchema);
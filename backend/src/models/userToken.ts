import mongoose, { Schema, Document } from 'mongoose';

export interface IUserToken extends Document {
  userId: string; // Reference to the user (can be ObjectId or string)
  walletAddress: string; // User's wallet address
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  metadataUri?: string;
  decimals: number;
  creator?: string;
  creationTimestamp: number;
  currentPrice?: number;
  totalVolume?: number;
  totalTransactions?: number;
  lastUpdated: Date;
  platform: 'memehome' | 'pumpfun';
  buyAmount: number; // Amount bought
  lastBuySignature?: string;
  lastSellSignature?: string;
  balance: number; // Total token balance in the user's wallet
  buyTime?: Date; // Date/time when the token was bought
}

const UserTokenSchema: Schema = new Schema({
  // amazonq-ignore-next-line
  userId: { type: String, required: true, index: true },
  walletAddress: { type: String, required: true, index: true },
  mint: { type: String, required: true, index: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  imageUrl: { type: String },
  metadataUri: { type: String },
  decimals: { type: Number, required: true, default: 9 },
  creator: { type: String },
  creationTimestamp: { type: Number, required: true },
  currentPrice: { type: Number },
  totalVolume: { type: Number, default: 0 },
  totalTransactions: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  platform: { type: String, enum: ['memehome', 'pumpfun'], default: 'memehome' },
  buyAmount: { type: Number, default: 0 },
  lastBuySignature: { type: String },
  lastSellSignature: { type: String },
  balance: { type: Number, default: 0 }, // Total token balance in the user's wallet
  buyTime: { type: Date }, // Date/time when the token was bought
});

UserTokenSchema.index({ userId: 1, mint: 1 }, { unique: true });
UserTokenSchema.index({ walletAddress: 1, mint: 1 });

export const UserToken = mongoose.model<IUserToken>('UserToken', UserTokenSchema);

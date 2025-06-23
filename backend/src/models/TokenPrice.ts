import mongoose, { Schema, Document } from 'mongoose';
import { wss } from '../trade-bot/tokenListner';

export interface ITokenPrice extends Document {
  mint: string;
  currentPrice: number;
  lastUpdated?: Date;
}

const TokenPriceSchema: Schema = new Schema({
  mint: { type: String, required: true, unique: true },
  currentPrice: { type: Number, required: true },
  lastUpdated: { type: Date }
});

// Post-update hook for findOneAndUpdate
TokenPriceSchema.post('findOneAndUpdate', async function (doc: any) {
  if (doc && wss && wss.clients) {
    const priceUpdate = {
      type: 'PRICE_UPDATE',
      prices: [{ mint: doc.mint, currentPrice: doc.currentPrice }]
    };
    wss.clients.forEach((ws: any) => {
      ws.send(JSON.stringify(priceUpdate));
    });
  }
});

export const TokenPrice = mongoose.model<ITokenPrice>('TokenPrice', TokenPriceSchema);

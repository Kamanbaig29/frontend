import mongoose, { Schema, Document } from 'mongoose';
import { wss } from '../trade-bot/tokenListner';

export interface ITokenPrice extends Document {
  mint: string;
  userPublicKey: string;
  currentPrice: number;
  buyPrice?: number;
  lastUpdated?: Date;
}

const TokenPriceSchema: Schema = new Schema({
  mint: { type: String, required: true },
  userPublicKey: { type: String, required: true },
  currentPrice: { type: Number, required: true },
  buyPrice: { type: Number },
  lastUpdated: { type: Date }
});
TokenPriceSchema.index({ mint: 1, userPublicKey: 1 }, { unique: true });

// Post-update hook for findOneAndUpdate
TokenPriceSchema.post('findOneAndUpdate', async function (doc: any) {
  if (doc && wss && wss.clients) {
    const priceUpdate = {
      type: 'TOKEN_UPDATE',
      token: {
        mint: doc.mint,
        currentPrice: doc.currentPrice,
        lastUpdated: doc.lastUpdated,
        buyPrice: doc.buyPrice
      }
    };
    wss.clients.forEach((ws: any) => {
      ws.send(JSON.stringify(priceUpdate));
    });
  }
});

export const TokenPrice = mongoose.model<ITokenPrice>('TokenPrice', TokenPriceSchema);

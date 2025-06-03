import mongoose from 'mongoose';

const autoTokenBuySchema = new mongoose.Schema({
  mint: { type: String, required: true, unique: true },
  creator: { type: String, required: true },
  bondingCurve: { type: String, required: true },
  curveTokenAccount: { type: String, required: true },
  userTokenAccount: { type: String, required: true },
  metadata: { type: String, required: true },
  decimals: { type: Number, required: true },
  supply: { type: String },
  buyTimestamp: { type: Number, required: true },
  transactionSignature: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['bought', 'buying', 'failed'],
    required: true 
  }
});

export const AutoTokenBuy = mongoose.model('AutoTokenBuy', autoTokenBuySchema);
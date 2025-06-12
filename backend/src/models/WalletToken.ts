import mongoose from 'mongoose';

interface IWalletToken {
  mint: string;
  amount: string;
  buyPrice: number; // <-- changed here
  name: string;
  symbol: string;
  decimals: number;
  userPublicKey: string;  // Added this field
}

const walletTokenSchema = new mongoose.Schema<IWalletToken>({
  mint: { 
    type: String, 
    // required: true, 
  },
  amount: { 
    type: String, 
    // required: true 
  },
  buyPrice: {  // <-- changed here
    type: Number,
    default: 0 
  },
  name: { 
    type: String, 
    default: 'Unknown' 
  },
  symbol: { 
    type: String, 
    default: 'Unknown' 
  },
  decimals: { 
    type: Number, 
    default: 6 
  },
  userPublicKey: {  // Added this field
    type: String,
    required: true
  }
});

walletTokenSchema.index({ mint: 1, userPublicKey: 1 }, { unique: true });

export const WalletToken = mongoose.model('WalletToken', walletTokenSchema);

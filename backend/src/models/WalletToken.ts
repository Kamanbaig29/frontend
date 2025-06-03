import mongoose from 'mongoose';

interface IWalletToken {
  mint: string;
  amount: string;
  currentPrice: number;
  name: string;
  symbol: string;
  decimals: number;
}

const walletTokenSchema = new mongoose.Schema<IWalletToken>({
  mint: { 
    type: String, 
    required: true, 
    unique: true 
  },
  amount: { 
    type: String, 
    required: true 
  },
  currentPrice: { 
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
  }
});

export const WalletToken = mongoose.model('WalletToken', walletTokenSchema);
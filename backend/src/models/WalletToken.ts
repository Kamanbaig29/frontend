import mongoose, { Schema, Document } from 'mongoose';
import { wss } from '../trade-bot/tokenListner'; // Only import wss
//import { sendFullStatsToClient } from '../helper-functions/dbStatsBroadcaster';

interface IWalletToken {
  mint: string;
  amount: string;
  buyPrice: number; // <-- changed here
  name: string;
  symbol: string;
  decimals: number;
  userPublicKey: string;  // Added this field
}

const WalletTokenSchema = new Schema<IWalletToken>({
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
  },
});

WalletTokenSchema.index({ mint: 1, userPublicKey: 1 }, { unique: true });

// Remove or comment out the post hooks since they use clientPages which no longer exists
/*
WalletTokenSchema.post('save', async function (doc: any) {
  // Post hooks removed - stats are now sent via WebSocket when users connect
});

WalletTokenSchema.post('findOneAndUpdate', async function (doc: any) {
  // Post hooks removed - stats are now sent via WebSocket when users connect
});
*/

export const WalletToken = mongoose.model('WalletToken', WalletTokenSchema);

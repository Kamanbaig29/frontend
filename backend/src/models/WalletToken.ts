import mongoose, { Schema, Document } from 'mongoose';
import { wss, clientPages } from '../trade-bot/tokenListner'; // Import the map
import { sendFullStatsToClient } from '../helper-functions/dbStatsBroadcaster';

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

WalletTokenSchema.post('save', async function (doc: any) {
  if (wss && wss.clients) {
    wss.clients.forEach((ws: any) => {
      const page = clientPages.get(ws) || 1;
      sendFullStatsToClient(ws, page, 10);
    });
  }
});

WalletTokenSchema.post('findOneAndUpdate', async function (doc: any) {
  if (wss && wss.clients) {
    wss.clients.forEach((ws: any) => {
      const page = clientPages.get(ws) || 1;
      sendFullStatsToClient(ws, page, 10);
    });
  }
});

export const WalletToken = mongoose.model('WalletToken', WalletTokenSchema);

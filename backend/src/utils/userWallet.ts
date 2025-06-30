import User from '../models/user_auth';
import { decryptWalletSecretKey } from './walletUtils';
import { Keypair } from '@solana/web3.js';

// For MongoDB ObjectId
export const getUserKeypairById = async (userId: string) => {
  const user = await User.findById(userId).select('+botWalletSecretKeyEncrypted');
  if (!user || !user.botWalletSecretKeyEncrypted) {
    throw new Error('User wallet not found');
  }
  const secretKeyArray = decryptWalletSecretKey(user.botWalletSecretKeyEncrypted);
  return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
};

// For Solana public key
export const getUserKeypairByWallet = async (walletPublicKey: string) => {
  const user = await User.findOne({ botWalletPublicKey: walletPublicKey }).select('+botWalletSecretKeyEncrypted');
  if (!user || !user.botWalletSecretKeyEncrypted) {
    throw new Error('User wallet not found');
  }
  const secretKeyArray = decryptWalletSecretKey(user.botWalletSecretKeyEncrypted);
  return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
};

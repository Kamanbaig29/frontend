import User from '../models/user_auth';
import { startWalletSyncWatcher } from '../helper-functions/wallet-token-watcher';
import { startPriceUpdateService } from '../helper-functions/priceUpdateService';
import { startAutoSellWorker } from '../helper-functions/autosellworker';
import { Connection, PublicKey } from '@solana/web3.js';
import { getConnection } from '../utils/getProvider';

const userServiceMap = new Map<string, { cleanupFns: (() => void)[] }>();

// Main function to start all services for a user
export const startUserServices = async (userId: string, userPublicKey: string) => {
  try {
    console.log(`[DEBUG] Starting services for user: ${userId} - Wallet: ${userPublicKey}`);
    
    // Temporarily disable these services for debugging
    // console.log(`[DEBUG] Starting price update service for ${userPublicKey}`);
    // startPriceUpdateService(userPublicKey, 5 * 60 * 1000); // 5 minutes
    
    // console.log(`[DEBUG] Starting auto-sell worker for ${userPublicKey}`);
    // startAutoSellWorker(userPublicKey);
    
    // console.log(`[DEBUG] Starting wallet sync watcher for ${userPublicKey}`);
    // startWalletSyncWatcher(userPublicKey);

    console.log(`[DEBUG] All background services (except token listener) are temporarily disabled.`);

  } catch (error) {
    console.error(`❌ Failed to start services for user ${userPublicKey}:`, error);
  }
};

export async function stopUserServices(userId: string) {
  const services = userServiceMap.get(userId);
  if (services) {
    services.cleanupFns.forEach(fn => fn());
    userServiceMap.delete(userId);
  }
}

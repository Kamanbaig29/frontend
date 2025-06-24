import dotenv from "dotenv";
dotenv.config();

import { connectDatabase } from "./config/database";
import { startTokenListener } from "./trade-bot/tokenListner";
import { Connection, PublicKey } from "@solana/web3.js";
import { startWalletSyncWatcher } from "../src/helper-functions/wallet-token-watcher";
import { startPriceUpdateService } from '../src/helper-functions/priceUpdateService';
import { startAutoSellWorker } from './helper-functions/autosellworker';

// import { startDbStatsBroadcaster } from './helper-functions/dbStatsBroadcaster';

let cleanupWatcher: (() => void) | null = null;

async function main() {
  // Connect to MongoDB first
  await connectDatabase();
  
  const connection = new Connection(process.env.RPC_ENDPOINT!);
  const walletPublicKey = new PublicKey(process.env.BUYER_PUBLIC_KEY!);

  console.log("Connected to Wallet watcher Activated");
  cleanupWatcher = await startWalletSyncWatcher(connection, walletPublicKey);
  // Start price update service
  //startPriceUpdateService(30000); // 10 seconds interval
  // Then start the token listener
  startTokenListener();
  // Start the auto sell worker
  //startAutoSellWorker();

  console.log("🚀 Bot started successfully");

  // startDbStatsBroadcaster(1000); // 3 second interval
}

main();

process.on("SIGINT", () => {
  console.log("Received SIGINT, cleaning up...");
  if (cleanupWatcher) cleanupWatcher();
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, cleaning up...");
  if (cleanupWatcher) cleanupWatcher();
  process.exit(0);
});


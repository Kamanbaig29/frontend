import dotenv from "dotenv";
dotenv.config();

import { connectDatabase } from "./config/database";
import { startTokenListener } from "./trade-bot/tokenListner";
import { Connection, PublicKey } from "@solana/web3.js";
import { watchWalletTokens } from "../src/helper-functions/wallet-token-watcher";
import { startPriceUpdateService } from '../src/helper-functions/priceUpdateService';

let cleanupWatcher: (() => void) | null = null;

async function main() {
  // Connect to MongoDB first
  await connectDatabase();
  
  const connection = new Connection(process.env.RPC_ENDPOINT!);
  const walletPublicKey = new PublicKey(process.env.BUYER_PUBLIC_KEY!);

  console.log("Connected to Wallet watcher Activated");
  cleanupWatcher = await watchWalletTokens(connection, walletPublicKey);
  // Then start the token listener
  startTokenListener();

  console.log("🚀 Bot started successfully");

  // Start price update service
  
}

main().catch(console.error);


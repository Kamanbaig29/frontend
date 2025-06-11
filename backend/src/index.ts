import dotenv from "dotenv";
dotenv.config();

import { connectDatabase } from "./config/database";
import { startTokenListener } from "./trade-bot/tokenListner";
import { Connection, PublicKey } from "@solana/web3.js";
import { watchWalletTokens } from "../src/helper-functions/wallet-token-watcher";

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

  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    if (cleanupWatcher) {
      cleanupWatcher();
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    if (cleanupWatcher) {
      cleanupWatcher();
    }
    process.exit(0);
  });
}

main().catch(console.error);


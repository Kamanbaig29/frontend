import dotenv from "dotenv";
dotenv.config();

// --- Express and Auth Imports ---
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes'; 

// --- Existing Bot Imports ---
import { connectDatabase } from "./config/database";
import { startTokenListener } from "./trade-bot/tokenListner";
import { Connection, PublicKey } from "@solana/web3.js";
import { startWalletSyncWatcher } from "../src/helper-functions/wallet-token-watcher";
import { startPriceUpdateService } from '../src/helper-functions/priceUpdateService';
import { startAutoSellWorker } from './helper-functions/autosellworker';

// import { startDbStatsBroadcaster } from './helper-functions/dbStatsBroadcaster';

// --- Cleanup Variables ---
let cleanupWatcher: (() => void) | null = null;
let cleanupPriceService: (() => void) | null = null;
let cleanupAutoSellWorker: (() => void) | null = null;

async function main() {
  // --- 1. Connect to Database ---
  // connectDatabase() will handle the connection using MONGO_URI from .env
  await connectDatabase();

  // --- 2. Setup and Start Express API Server ---
  const app = express();
  const PORT = process.env.API_PORT || 4000;

  app.use(cors()); // Enable CORS for frontend
  app.use(express.json()); // Enable JSON body parsing
  app.use('/api/auth', authRoutes); // Register authentication routes

  app.get('/', (req, res) => {
    res.send('Bot and API server is running!');
  });
  
  app.listen(PORT, () => {
    console.log(`🚀 API Server listening on http://localhost:${PORT}`);
  });

  // --- 3. Start Existing Bot Services ---
  const connection = new Connection(process.env.RPC_ENDPOINT!);
  const walletPublicKey = new PublicKey(process.env.BUYER_PUBLIC_KEY!);

  console.log("Wallet watcher Activated");
  cleanupWatcher = await startWalletSyncWatcher(connection, walletPublicKey);
  
  cleanupPriceService = startPriceUpdateService();
  
  startTokenListener();
  
  cleanupAutoSellWorker = startAutoSellWorker();

  console.log("🚀 Bot services started successfully");
}

main().catch(err => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});

// --- Graceful Shutdown Logic (Existing) ---
process.on("SIGINT", () => {
  console.log("Received SIGINT, cleaning up...");
  if (cleanupWatcher) cleanupWatcher();
  if (cleanupPriceService) cleanupPriceService();
  if (cleanupAutoSellWorker) cleanupAutoSellWorker();
  console.log("✅ All services stopped successfully");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, cleaning up...");
  if (cleanupWatcher) cleanupWatcher();
  if (cleanupPriceService) cleanupPriceService();
  if (cleanupAutoSellWorker) cleanupAutoSellWorker();
  console.log("✅ All services stopped successfully");
  process.exit(0);
});


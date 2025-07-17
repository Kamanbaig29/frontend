import dotenv from "dotenv";
dotenv.config();

// --- Express and Auth Imports ---
import express from 'express';
import cors from 'cors';
import http from 'http';
//import { WebSocketServer } from 'ws';
import authRoutes from './routes/authRoutes'; 
import botRoutes from './routes/botRoutes';
import tokenRoutes from './routes/tokenRoutes';
import autoSellRoutes from './routes/autoSellRoutes';
import userFilterRoutes from './routes/userFilterRoutes';
import path from 'path';

// --- Existing Bot Imports ---
import { connectDatabase } from "./config/database";
//import { startTokenListener } from "./trade-bot/tokenListner";
//import { Connection } from "@solana/web3.js";
//import { startWalletSyncWatcher } from "../src/helper-functions/wallet-token-watcher";
//import { startPriceUpdateService } from '../src/helper-functions/priceUpdateService';
//import { checkAndExecuteAllAutoSells } from './helper-functions/autosellworker';
import { createWebSocketServer, setupWebSocketHandlers } from './trade-bot/tokenListner';
import { startMemeHomeTokenWorker } from './helper-functions/memeHomeTokenWorker';
import { startAutoSellWorker, stopAutoSellWorker } from './helper-functions/autosellworker';

// import { startDbStatsBroadcaster } from './helper-functions/dbStatsBroadcaster';

// --- Cleanup Variables ---
//let cleanupWatcher: (() => void) | null = null;
//let cleanupPriceService: (() => void) | null = null;
//let cleanupAutoSellWorker: (() => void) | null = null;

async function main() {
  // --- 1. Connect to Database ---
  // connectDatabase() will handle the connection using MONGO_URI from .env
  await connectDatabase();

  // --- 2. Setup and Start Express API Server ---
  const app = express();
  const PORT = Number(process.env.API_PORT) || 4000;
  //const apiLink = process.env.API_LINK;

  app.use(cors()); // Enable CORS for frontend
  app.use(express.json()); // Enable JSON body parsing
  app.use('/api/auth', authRoutes); // Register authentication routes
  app.use('/api/bot', botRoutes);
  app.use('/api/tokens', tokenRoutes);
  app.use('/api/auto-sell', autoSellRoutes);
  app.use('/api/user-filters', userFilterRoutes);

  // --- Serve React Frontend Build ---
  const frontendPath = path.join(__dirname, '../../dist'); // Adjust if needed
  app.use(express.static(frontendPath));

  // Health check route (should be before the catch-all)
  app.get('/', (req, res) => {
    res.send('Bot and API server is running!');
  });

  // Fallback: serve index.html for any non-API route (for React Router)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next(); // Pass to next middleware for API routes
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  // --- Debug: Print all registered routes ---
  // function printRoutes() {
  //   if (!app._router || !app._router.stack) return;
  //   console.log('--- Registered routes ---');
  //   app._router.stack.forEach((middleware: any) => {
  //     if (middleware.route) {
  //       // routes registered directly on the app
  //       const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
  //       console.log(`${methods} ${middleware.route.path}`);
  //     } else if (middleware.name === 'router' && middleware.handle.stack) {
  //       // router middleware
  //       middleware.handle.stack.forEach((handler: any) => {
  //         const route = handler.route;
  //         if (route) {
  //           const methods = Object.keys(route.methods).join(',').toUpperCase();
  //           console.log(`${methods} ${route.path}`);
  //         }
  //       });
  //     }
  //   });
  //   console.log('------------------------');
  // }
  // printRoutes()

  // Create HTTP server and attach Express app
  const server = http.createServer(app);

  // Create WebSocket server on the same HTTP server
  const wss = createWebSocketServer(server);
  setupWebSocketHandlers(wss);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API & WebSocket Server listening on http://localhost:${PORT}`);
    // Start the AutoSell worker only after server is ready
    startAutoSellWorker();
  });
  // --- 3. Start Existing Bot Services ---
  //const connection = new Connection(process.env.RPC_ENDPOINT!);

  // Start global auto-sell worker
  //setInterval(() => checkAndExecuteAllAutoSells(connection), 5000);

  // Start MemeHome token worker
  startMemeHomeTokenWorker(wss);

  // REMOVE or COMMENT OUT these lines:
  // console.log("Wallet watcher Activated");
  // cleanupWatcher = await startWalletSyncWatcher(connection);
  // cleanupPriceService = startPriceUpdateService();
  // startTokenListener();
  // cleanupAutoSellWorker = startAutoSellWorker();

  // console.log("🚀 Bot services started successfully");
}

main().catch(err => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});

// --- Graceful Shutdown Logic (Existing) ---
process.on("SIGINT", () => {
  console.log("Received SIGINT, cleaning up...");
  stopAutoSellWorker();
  // if (cleanupWatcher) cleanupWatcher();
  // if (cleanupPriceService) cleanupPriceService();
  // if (cleanupAutoSellWorker) cleanupAutoSellWorker();
  console.log("✅ All services stopped successfully");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, cleaning up...");
  stopAutoSellWorker();
  // if (cleanupWatcher) cleanupWatcher();
  // if (cleanupPriceService) cleanupPriceService();
  // if (cleanupAutoSellWorker) cleanupAutoSellWorker();
  console.log("✅ All services stopped successfully");
  process.exit(0);
});

// Export WebSocket server for use in other modules
//export { wss };


import dotenv from "dotenv";
dotenv.config();

import { connectDatabase } from "./config/database";
import { startTokenListener } from "./trade-bot/tokenListner";

async function main() {
  // Connect to MongoDB first
  await connectDatabase();

  // Then start the token listener
  startTokenListener();

  console.log("🚀 Bot started successfully");
}

main().catch(console.error);

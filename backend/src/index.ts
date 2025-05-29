import dotenv from "dotenv";
dotenv.config();

import { startTokenListener } from "./trade-bot/tokenListner";

console.log("🔧 Starting bot...");
startTokenListener();

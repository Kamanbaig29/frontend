// amazonq-ignore-next-line// src/utils/getConnectionAndKeypair.ts
import { Connection, Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export function getConnection(): Connection {
  const rpcUrl = process.env.RPC_ENDPOINT;
  if (!rpcUrl) {
    throw new Error("RPC_ENDPOINT not set in .env");
  }
  return new Connection(rpcUrl, "confirmed");
}

export function getKeypair(): Keypair {
  const secretKeyPath = path.join(__dirname, "../wallet/my-keypair.json");
  if (!fs.existsSync(secretKeyPath)) {
    // amazonq-ignore-next-line
    throw new Error("wallet.json file not found.");
  }

  const secret = JSON.parse(fs.readFileSync(secretKeyPath, "utf-8"));
  const secretKey = Uint8Array.from(secret);
  return Keypair.fromSecretKey(secretKey);
}

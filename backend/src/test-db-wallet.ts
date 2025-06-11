require('dotenv').config();
const { PublicKey } = require('@solana/web3.js');
import { Connection } from "@solana/web3.js";
import { watchWalletTokens } from "../src/helper-functions/wallet-token-watcher";
import { connectDatabase } from "./config/database";

(async () => {
  await connectDatabase();

  console.log("BUYER_PUBLIC_KEY:", process.env.BUYER_PUBLIC_KEY);

  try {
    const pubkey = new PublicKey(process.env.BUYER_PUBLIC_KEY);
    console.log("PublicKey created:", pubkey.toBase58());
  } catch (e) {
    console.error("Error creating PublicKey:", e);
    return;
  }

  const connection = new Connection(process.env.RPC_ENDPOINT!);
  const walletPublicKey = new PublicKey(process.env.BUYER_PUBLIC_KEY!);

  await watchWalletTokens(connection, walletPublicKey);
})();

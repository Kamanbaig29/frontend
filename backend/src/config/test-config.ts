import dotenv from "dotenv";
import { PublicKey } from "@solana/web3.js";

dotenv.config();

export const MEMEHOME_PROGRAM_ID = new PublicKey(process.env.MEMEHOME_PROGRAM_ID!);
export const RPC_ENDPOINT = process.env.RPC_ENDPOINT!;
export const RPC_WEBSOCKET_ENDPOINT = process.env.RPC_WEBSOCKET_ENDPOINT!;
//export const BUYER_PUBLIC_KEY = new PublicKey(process.env.BUYER_PUBLIC_KEY!);

// Parse secret key array from string to Uint8Array
//export const USER_SECRET_KEY = Uint8Array.from(
  //JSON.parse(process.env.USER_SECRET_KEY!)
//);

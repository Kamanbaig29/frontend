// import { getConnection, getKeypair } from "./getProvider";

// async function test() {
//   try {
//     const connection = getConnection();
//     const keypair = getKeypair();

//     console.log("✅ Connection and Keypair loaded successfully!");
//     console.log("RPC Endpoint:", connection.rpcEndpoint);
//     console.log("Wallet PublicKey:", keypair.publicKey.toBase58());

//     // Optional: check balance
//     const balance = await connection.getBalance(keypair.publicKey);
//     console.log(`Wallet Balance: ${balance / 1e9} SOL`);
//   } catch (error) {
//     console.error("❌ Error during test:", error);
//   }
// }

// test();


import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// Step 1: Inputs
const mint = new PublicKey("57SJziby8NGNa945ethvsk5fq3NEX3SxZnb2Ne8Vpump");
const pumpProgramId = new PublicKey("9xQeWvG816bUx9EPX5Qn6jLRnWcoykq2NyjFqB1pJw61");

// Step 2: Derive Curve PDA
const [curvePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("curve"), mint.toBuffer()],
  pumpProgramId
);

// Step 3: Derive curveToken ATA (Associated Token Account)
const curveTokenAddress = getAssociatedTokenAddressSync(mint, curvePDA, true);

console.log("Curve PDA:", curvePDA.toBase58());
console.log("Curve Token Address:", curveTokenAddress.toBase58());

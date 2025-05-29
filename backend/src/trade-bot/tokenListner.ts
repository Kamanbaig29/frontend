import { Connection, PublicKey } from "@solana/web3.js";
import { getConnection } from "../utils/getProvider";
import { getSwapAccounts } from "../action/getSwapAccounts"; // Adjust path if needed
import { buyToken } from "../action/buy"; // Adjust import path
import { Keypair } from "@solana/web3.js";

const MEMEHOME_PROGRAM_ID = new PublicKey(process.env.MEMEHOME_PROGRAM_ID!);

// env variable se string read karo
const secretKeyString = process.env.USER_SECRET_KEY;
if (!secretKeyString) {
  throw new Error("USER_SECRET_KEY is not set in .env");
}

// JSON.parse karke array banao
const secretKeyArray: number[] = JSON.parse(secretKeyString);

// Convert to Uint8Array
const secretKey = Uint8Array.from(secretKeyArray);

// Keypair generate karo
const userKeypair = Keypair.fromSecretKey(secretKey);


export function startTokenListener() {
  const connection = getConnection();

  console.log(`👀 Subscribing to logs from program: ${MEMEHOME_PROGRAM_ID.toBase58()}`);

  connection.onLogs(
    MEMEHOME_PROGRAM_ID,
    async (logInfo) => {
      const { logs, signature } = logInfo;

      const creationLog = logs.find(
        (log) =>
          log.toLowerCase().includes("create") || log.toLowerCase().includes("mint")
      );

      if (creationLog) {
        console.log("🎯 New token detected!");

        try {
          const tx = await connection.getTransaction(signature, { commitment: "confirmed" });

          if (!tx || !tx.transaction || !tx.transaction.message) {
            console.error("Transaction data not found or incomplete");
            return;
          }

          const accountKeys = tx.transaction.message.accountKeys;
          if (!accountKeys || accountKeys.length < 2) {
            console.error("Not enough account keys in transaction");
            return;
          }

          const mintAddress = accountKeys[1].toBase58();
          const owner = accountKeys[0].toBase58();
          const decimals = 9; // Adjust if you can fetch decimals dynamically

          console.log(`Mint Address: ${mintAddress}`);
          console.log(`Owner: ${owner}`);
          console.log(`Decimals: ${decimals}`);

          const buyerPublicKeyString = process.env.BUYER_PUBLIC_KEY;
          if (!buyerPublicKeyString) {
            console.error("BUYER_PUBLIC_KEY env variable is not set");
            return;
          }

          const buyer = new PublicKey(buyerPublicKeyString);

          // Fetch swap accounts needed for your buy instruction
          // const swapAccounts = await getSwapAccounts({
          //   mintAddress,
          //   buyer,
          //   connection,
          //   programId: MEMEHOME_PROGRAM_ID,
          // });


          const swapAccounts = await getSwapAccounts({
            mintAddress,
            buyer,
            connection,
            programId: MEMEHOME_PROGRAM_ID,
          });

          

          console.log("📦 Swap Accounts:", swapAccounts);

          // Example amount and minOut for buying — adjust as needed
          const amountToBuy = 1_000_000_000; // Example: 1 token with 9 decimals (1 * 10^9)
          const minOutAmount = 1; // Minimal amount expected, can be 0 or adjusted

          // Call your buyToken function here
          // const txid = await buyToken({
          //   connection,
          //   userKeypair,
          //   programId: MEMEHOME_PROGRAM_ID,
          //   swapAccounts,
          //   amountToBuy,
          //   minOutAmount,
          // });

          const txid = await buyToken({
            connection,
            userKeypair,
            programId: MEMEHOME_PROGRAM_ID,
            amount: amountToBuy,
            minOut: minOutAmount,
            swapAccounts, // ✅ This now works perfectly
          });

          console.log(`✅ Token Snipper Buy transaction sent. Txid: ${txid}`);

        } catch (error) {
          console.error("❌ Token Snipper Error handling token creation:", error);
        }
      }
    },
    "confirmed"
  );

  console.log("🕒 Waiting for token creation events...");
}

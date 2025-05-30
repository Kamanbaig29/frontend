// Add this declaration before your imports
declare global {
  var trackedTokens: TokenData[];
}

import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  TransactionConfirmationStrategy
} from "@solana/web3.js";
import { getConnection } from "../utils/getProvider";
import { getSwapAccounts } from "../action/getSwapAccounts"; // Adjust path if needed
import { buyToken } from "../action/buy"; // Adjust import path
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import WebSocket, { WebSocketServer } from 'ws';

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

// At the top of file, add this Set to track processed mints
const processedMints = new Set<string>();

// Add this interface at the top of the file
interface SolanaError extends Error {
  logs?: string[];
  code?: string | number;
  details?: Record<string, unknown>;
}

// Add interface for token data
interface TokenData {
  mint: string;
  creator: string;
  bondingCurve: string;
  curveTokenAccount: string;
  userTokenAccount: string;
  metadata: string;
  decimals: number;
  supply?: string;
}

// Add constants at the top
const BUY_AMOUNT = 100_000_000; // 0.1 SOL
const BUY_AMOUNT_ADJUSTED = Math.floor(BUY_AMOUNT / 1000); // 100_000
const MIN_OUT_AMOUNT = 1;
const DIRECTION = 0;

// Move sleep function outside
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Add after your other constants
const wss = new WebSocketServer({ port: 3001 });

console.log('📡 WebSocket server started on port 3001');

// Create a function to send updates to all connected clients
function broadcastUpdate(data: any) {
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

export function startTokenListener() {
  const connection = getConnection();
  
  console.log(`👀 Subscribing to logs from program: ${MEMEHOME_PROGRAM_ID.toBase58()}`);

  try {
    connection.onLogs(
      MEMEHOME_PROGRAM_ID,
      async (logInfo) => {
        const { logs, signature } = logInfo;
        let mintAddress: string | undefined;

        try {
          // Replace the creation log detection part with this:
          try {
            // More specific token creation detection
            const isCreateMint = logs.some(log => 
              log.includes("Program log: Instruction: InitializeMint2")
            );
            
            const isLaunchInstruction = logs.some(log =>
              log.includes("Program log: Instruction: Launch")
            );

            // Only proceed if both conditions are met
            if (!isCreateMint || !isLaunchInstruction) {
              return;
            }

            console.log("🎯 New token creation detected!");
            
            await sleep(2000);

            const tx = await connection.getTransaction(signature, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0
            });

            if (!tx?.transaction?.message) {
              console.log("❌ Invalid transaction data");
              return;
            }

            const accountKeys = tx.transaction.message.staticAccountKeys;
            
            // Collect all relevant addresses
            const tokenData: TokenData = {
              mint: accountKeys[1].toBase58(),
              creator: accountKeys[0].toBase58(),
              bondingCurve: accountKeys[3].toBase58(), // Bonding curve PDA
              curveTokenAccount: accountKeys[2].toBase58(), // Curve token account
              userTokenAccount: accountKeys[4].toBase58(), // Your token account
              metadata: accountKeys[9].toBase58(), // Metadata account
              decimals: 9
            };

            // Log detailed token info
            console.log("\n📋 Token Details:");
            console.log("----------------------------------------");
            console.log(`🎯 Mint Address:        ${tokenData.mint}`);
            console.log(`👤 Creator:            ${tokenData.creator}`);
            console.log(`📈 Bonding Curve:      ${tokenData.bondingCurve}`);
            console.log(`💰 Curve Token Account: ${tokenData.curveTokenAccount}`);
            console.log(`👛 User Token Account:  ${tokenData.userTokenAccount}`);
            console.log(`📄 Metadata Account:    ${tokenData.metadata}`);
            console.log(`🔢 Decimals:           ${tokenData.decimals}`);
            console.log("----------------------------------------\n");

            // Try to fetch token supply
            try {
              const mintInfo = await connection.getTokenSupply(new PublicKey(tokenData.mint));
              if (mintInfo.value) {
                tokenData.supply = mintInfo.value.amount;
                console.log(`💎 Token Supply: ${tokenData.supply}`);
              }
            } catch (error) {
              console.log("⚠️ Could not fetch token supply");
            }

            // Add to global tracking with type safety
            if (!global.trackedTokens) {
              global.trackedTokens = [] as TokenData[];
            }
            global.trackedTokens.push(tokenData);

            // Broadcast new token detection
            broadcastUpdate({
              type: 'NEW_TOKEN',
              tokenData: {
                mint: tokenData.mint,
                creator: tokenData.creator,
                bondingCurve: tokenData.bondingCurve,
                curveTokenAccount: tokenData.curveTokenAccount,
                userTokenAccount: tokenData.userTokenAccount,
                metadata: tokenData.metadata,
                decimals: tokenData.decimals,
                supply: tokenData.supply
              }
            });

            // Continue with existing buy logic...
            mintAddress = tokenData.mint;

            // Skip if already processed
            if (processedMints.has(mintAddress)) {
              console.log(`⏭️ Skipping: Already processed ${mintAddress}`);
              return;
            }

            // Add debug logs
            console.log("📝 Transaction logs:", logs);
            console.log("🔑 Account keys:", accountKeys.map(key => key.toBase58()));

            const owner = accountKeys[0].toBase58();
            const decimals = 9;

            console.log(`Mint Address: ${mintAddress}`);
            console.log(`Owner: ${owner}`);
            console.log(`Decimals: ${decimals}`);

            // Validate mint address before proceeding
            const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mintAddress));
            let mintType: string | undefined = undefined;
            if (
              mintInfo.value &&
              typeof mintInfo.value.data === "object" &&
              "parsed" in mintInfo.value.data
            ) {
              // @ts-ignore
              mintType = mintInfo.value.data.parsed.type;
            }
            if (mintType !== "mint") {
              console.error("❌ Skipping: accountKeys[1] is not a valid SPL Token Mint.");
              return;
            }

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

            // Calculate the correct ATA address for curveTokenAccount (bondingCurve PDA + tokenMint)
            const curveTokenATA = await getAssociatedTokenAddress(
              swapAccounts.tokenMint,
              swapAccounts.bondingCurve,
              true // allowOwnerOffCurve for PDA
            );

            console.log("curveTokenATA:", curveTokenATA.toBase58());
            console.log("tokenMint:", swapAccounts.tokenMint.toBase58());
            console.log("bondingCurve:", swapAccounts.bondingCurve.toBase58());

            const ataInfo = await connection.getAccountInfo(curveTokenATA);
            if (ataInfo) {
              // Check if it's a valid SPL Token Account
              const parsed = await connection.getParsedAccountInfo(curveTokenATA);
              if (
                parsed.value &&
                typeof parsed.value.data === "object" &&
                "parsed" in parsed.value.data &&
                parsed.value.data.parsed.type === "account"
              ) {
                console.log("curveTokenAccount already exists and is a valid token account, skipping creation.");
              } else {
                console.error("❌ curveTokenAccount exists but is NOT a valid SPL Token Account. Skipping creation to avoid error.");
                // Don't try to create or use this account, just skip this token
                return;
              }
            } else {
              try {
                console.log("⚡ Creating curveTokenAccount before buy...");
                const createAtaIx = createAssociatedTokenAccountInstruction(
                  userKeypair.publicKey,      // payer
                  curveTokenATA,              // associated token account address
                  swapAccounts.bondingCurve,  // owner (PDA)
                  swapAccounts.tokenMint,     // mint
                );

                // Create and send transaction
                const createAtaTx = new Transaction()
                  .add(createAtaIx);
              
                createAtaTx.feePayer = userKeypair.publicKey;
                createAtaTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

                // Sign transaction (fixed method)
                createAtaTx.sign(userKeypair);
              
                // Send raw transaction
                const signature = await connection.sendRawTransaction(createAtaTx.serialize());
              
                // Wait for confirmation
                const confirmation = await connection.confirmTransaction(signature, "confirmed");
              
                if (confirmation.value.err) {
                  throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
                }

                console.log("✅ curveTokenAccount created successfully!");
              
                // Verify ATA was created
                const newAtaInfo = await connection.getAccountInfo(curveTokenATA);
                if (!newAtaInfo) {
                  throw new Error("ATA creation failed - account not found");
                }

              } catch (ataError) {
                console.error("❌ Failed to create ATA:", ataError);
                return; // Exit if ATA creation fails
              }
            }

            // Ab buyToken call karo (swapAccounts.curveTokenAccount = curveTokenATA hona chahiye)
            swapAccounts.curveTokenAccount = curveTokenATA;

            // Update buy parameters
            // swapAccounts.curveTokenAccount = curveTokenATA;

            // Add validation before buy
            if (!swapAccounts.userTokenAccount || !swapAccounts.curveTokenAccount) {
              console.error("❌ Missing required token accounts");
              return;
            }

            try {
              const signature = await buyToken({
                connection,
                userKeypair,
                programId: MEMEHOME_PROGRAM_ID,
                amount: BUY_AMOUNT_ADJUSTED,
                minOut: MIN_OUT_AMOUNT,
                direction: DIRECTION,
                swapAccounts,
              });

              if (!signature) {
                console.error("❌ Buy transaction failed - no signature returned");
                return;
              }

              console.log(`📝 Buy transaction signature: ${signature}`);

              // Create the confirmation strategy object
              const confirmationStrategy: TransactionConfirmationStrategy = {
                signature,
                blockhash: (await connection.getLatestBlockhash()).blockhash,
                lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
              };

              // Wait for confirmation with proper error handling
              const confirmation = await connection.confirmTransaction(confirmationStrategy);

              if (confirmation.value.err) {
                throw new Error(`Buy transaction failed: ${confirmation.value.err.toString()}`);
              }

              console.log("🎉 Buy transaction confirmed!");

              // Get transaction details
              const txDetails = await connection.getTransaction(signature, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0
              });

              if (!txDetails) {
                throw new Error("Failed to fetch transaction details");
              }

              console.log(`✨ Transaction successful!`);
              console.log(`📊 Transaction details:
                Signature: ${signature}
                Block: ${txDetails.slot}
                Fee: ${txDetails.meta?.fee} lamports
              `);

              // Only add to processed set after successful buy
              if (mintAddress) {
                processedMints.add(mintAddress);
                console.log(`✅ Successfully processed mint: ${mintAddress}`);
              }

              // Broadcast successful buy
              broadcastUpdate({
                type: 'BUY_SUCCESS',
                tokenData: {
                  mint: mintAddress,
                  // ...other token data
                },
                mintAddress: mintAddress // fallback
              });

            } catch (error) {
              console.error("❌ Buy transaction failed:", error);
              if (mintAddress) processedMints.delete(mintAddress);
              return;
            }

          } catch (error) {
            const solanaError = error as SolanaError;
            console.error("❌ Token Snipper Error:", {
              error: solanaError.message,
              logs: solanaError.logs || [],
              errorCode: solanaError.code || 'unknown',
              details: solanaError.details || {},
            });
            
            // Create a type for our error data
            type ErrorBroadcastData = {
              type: 'ERROR';
              message: string;
              tokenData?: TokenData;
            };

            // Create the error data with proper typing
            const errorData: ErrorBroadcastData = {
              type: 'ERROR',
              message: error instanceof Error ? error.message : 'An unknown error occurred'
            };

            // Only add tokenData if it's defined in this scope
            try {
              if (typeof global.trackedTokens !== 'undefined' && mintAddress) {
                const foundToken = global.trackedTokens.find(t => t.mint === mintAddress);
                if (foundToken) {
                  errorData.tokenData = foundToken;
                }
              }
            } catch (e) {
              console.error('Failed to attach token data to error:', e);
            }

            broadcastUpdate(errorData);

            if (mintAddress) processedMints.delete(mintAddress);
          }
        } catch (error) {
          console.error("🔴 Connection setup error:", error);
          // Retry connection after delay
          setTimeout(() => startTokenListener(), 5000);
        }
      },
      "confirmed"
    );

    console.log("🕒 Waiting for token creation events...");
  } catch (error) {
    console.error("🔴 Connection setup error:", error);
    // Retry connection after delay
    setTimeout(() => startTokenListener(), 5000);
  }
}

// Add near the top of the file
export function getTrackedTokens(): TokenData[] {
  return global.trackedTokens || [];
}

// Example usage
const tokens = getTrackedTokens();
tokens.forEach(token => {
  console.log(`Token ${token.mint}:`);
  console.log(`- Creator: ${token.creator}`);
  console.log(`- Bonding Curve: ${token.bondingCurve}`);
  // etc...
});

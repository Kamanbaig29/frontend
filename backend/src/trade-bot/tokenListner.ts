// Add this declaration before your imports
declare global {
  var trackedTokens: TokenData[];
}

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionConfirmationStrategy,
} from "@solana/web3.js";
import { getConnection } from "../utils/getProvider";
import { getSwapAccounts } from "../action/getSwapAccounts";
import { buyToken } from "../action/buy";
import { handleManualBuy } from "../action/manualBuy";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import WebSocket, { WebSocketServer } from "ws";
import bs58 from 'bs58';

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
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Add after your other constants
const wss = new WebSocketServer({ port: 3001 });

console.log("📡 WebSocket server started on port 3001");

// Create a function to send updates to all connected clients
function broadcastUpdate(data: any) {
  console.log('📤 Broadcasting update:', data);
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
      console.log('✅ Update sent to client');
    }
  });
}

// Add at the top with other interfaces
interface BotState {
  isAutoMode: boolean;
}

const botState = {
  isAutoMode: false
};

// Add these variables at the top with other state
let logListener: any = null;
let isListening = false;

// Add reset function
const resetBotState = () => {
  // Stop listening if active
  if (isListening && logListener) {
    const connection = getConnection();
    connection.removeOnLogsListener(logListener);
    logListener = null;
  }
  
  isListening = false;
  botState.isAutoMode = false;
  
  console.log('🔄 Bot state reset to initial state');
  
  // Broadcast reset to all clients
  broadcastUpdate({
    type: 'BOT_RESET',
    status: 'ready',
    mode: 'manual',
    message: 'Bot has been reset to initial state'
  });
};

// Add this function to check wallet balance
async function checkWalletBalance(connection: Connection, publicKey: PublicKey, requiredAmount: number): Promise<boolean> {
  try {
    const balance = await connection.getBalance(publicKey);
    console.log(`💰 Current wallet balance: ${balance / 1e9} SOL`);
    console.log(`💵 Required amount: ${requiredAmount / 1e9} SOL`);
    
    // Add buffer for transaction fees (0.01 SOL)
    const requiredWithBuffer = requiredAmount + 10_000_000;
    
    if (balance < requiredWithBuffer) {
      console.error(`❌ Insufficient balance. Need ${requiredWithBuffer / 1e9} SOL (including fees)`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ Error checking wallet balance:', error);
    return false;
  }
}

export function startTokenListener() {
  const connection = getConnection();
  console.log('🚀 Bot initialized - Waiting for mode selection...');

  // Function to start listening
  const startListening = () => {
    if (isListening) {
      console.log('👂 Already listening for tokens');
      return;
    }
    
    console.log('👂 Starting token listener...');
    logListener = connection.onLogs(
      MEMEHOME_PROGRAM_ID,
      async (logInfo) => {
        // Only process if in auto mode
        if (!botState.isAutoMode) {
          return;
        }

        const { logs, signature } = logInfo;
        let mintAddress: string | undefined;

        try {
          // More specific token creation detection
          const isCreateMint = logs.some((log) =>
            log.includes("Program log: Instruction: InitializeMint2")
          );

          const isLaunchInstruction = logs.some((log) =>
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
            maxSupportedTransactionVersion: 0,
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
            decimals: 9,
          };

          // Log detailed token info
          console.log("\n📋 Token Details:");
          console.log("----------------------------------------");
          console.log(`🎯 Mint Address:        ${tokenData.mint}`);
          console.log(`👤 Creator:            ${tokenData.creator}`);
          console.log(`📈 Bonding Curve:      ${tokenData.bondingCurve}`);
          console.log(`💰 Curve Token Account: ${tokenData.curveTokenAccount}`);
          console.log(` User Token Account:  ${tokenData.userTokenAccount}`);
          console.log(`📄 Metadata Account:    ${tokenData.metadata}`);
          console.log(`🔢 Decimals:           ${tokenData.decimals}`);
          console.log("----------------------------------------\n");

          // Try to fetch token supply
          try {
            const mintInfo = await connection.getTokenSupply(
              new PublicKey(tokenData.mint)
            );
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
            type: "NEW_TOKEN",
            tokenData: {
              mint: tokenData.mint,
              creator: tokenData.creator,
              bondingCurve: tokenData.bondingCurve,
              curveTokenAccount: tokenData.curveTokenAccount,
              userTokenAccount: tokenData.userTokenAccount,
              metadata: tokenData.metadata,
              decimals: tokenData.decimals,
              supply: tokenData.supply,
            },
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
          console.log(
            "🔑 Account keys:",
            accountKeys.map((key) => key.toBase58())
          );

          const owner = accountKeys[0].toBase58();
          const decimals = 9;

          console.log(`Mint Address: ${mintAddress}`);
          console.log(`Owner: ${owner}`);
          console.log(`Decimals: ${decimals}`);

          // Validate mint address before proceeding
          const mintInfo = await connection.getParsedAccountInfo(
            new PublicKey(mintAddress)
          );
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
            console.error(
              "❌ Skipping: accountKeys[1] is not a valid SPL Token Mint."
            );
            return;
          }

          const buyerPublicKeyString = process.env.BUYER_PUBLIC_KEY;
          if (!buyerPublicKeyString) {
            console.error("BUYER_PUBLIC_KEY env variable is not set");
            return;
          }

          const buyer = new PublicKey(buyerPublicKeyString);

          // Fetch swap accounts needed for your buy instruction
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
            const parsed = await connection.getParsedAccountInfo(
              curveTokenATA
            );
            if (
              parsed.value &&
              typeof parsed.value.data === "object" &&
              "parsed" in parsed.value.data &&
              parsed.value.data.parsed.type === "account"
            ) {
              console.log(
                "curveTokenAccount already exists and is a valid token account, skipping creation."
              );
            } else {
              console.error(
                "❌ curveTokenAccount exists but is NOT a valid SPL Token Account. Skipping creation to avoid error."
              );
              // Don't try to create or use this account, just skip this token
              return;
            }
          } else {
            try {
              console.log("⚡ Creating curveTokenAccount before buy...");
              const createAtaIx = createAssociatedTokenAccountInstruction(
                userKeypair.publicKey, // payer
                curveTokenATA, // associated token account address
                swapAccounts.bondingCurve, // owner (PDA)
                swapAccounts.tokenMint // mint
              );

              // Create and send transaction
              const createAtaTx = new Transaction().add(createAtaIx);

              createAtaTx.feePayer = userKeypair.publicKey;
              createAtaTx.recentBlockhash = (
                await connection.getLatestBlockhash()
              ).blockhash;

              // Sign transaction (fixed method)
              createAtaTx.sign(userKeypair);

              // Send raw transaction
              const signature = await connection.sendRawTransaction(
                createAtaTx.serialize()
              );

              // Wait for confirmation
              const confirmation = await connection.confirmTransaction(
                signature,
                "confirmed"
              );

              if (confirmation.value.err) {
                throw new Error(
                  `Transaction failed: ${confirmation.value.err.toString()}`
                );
              }

              console.log("✅ curveTokenAccount created successfully!");

              // Verify ATA was created
              const newAtaInfo = await connection.getAccountInfo(
                curveTokenATA
              );
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

          // Add validation before buy
          if (
            !swapAccounts.userTokenAccount ||
            !swapAccounts.curveTokenAccount
          ) {
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
              console.error(
                "❌ Buy transaction failed - no signature returned"
              );
              return;
            }

            console.log(`📝 Buy transaction signature: ${signature}`);

            // Create the confirmation strategy object
            const confirmationStrategy: TransactionConfirmationStrategy = {
              signature,
              blockhash: (await connection.getLatestBlockhash()).blockhash,
              lastValidBlockHeight: (await connection.getLatestBlockhash())
                .lastValidBlockHeight,
            };

            // Wait for confirmation with proper error handling
            const confirmation = await connection.confirmTransaction(
              confirmationStrategy
            );

            if (confirmation.value.err) {
              throw new Error(
                `Buy transaction failed: ${confirmation.value.err.toString()}`
              );
            }

            console.log("🎉 Buy transaction confirmed!");

            // Get transaction details
            const txDetails = await connection.getTransaction(signature, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
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
              type: "BUY_SUCCESS",
              tokenData: {
                mint: mintAddress,
                stats: {
                  mint: mintAddress,
                  buyPrice: BUY_AMOUNT / 1e9, // Convert lamports to SOL
                  currentPrice: BUY_AMOUNT / 1e9,
                  profitLoss: 0,
                  profitPercentage: 0,
                  holdingTime: '0m',
                  status: 'holding'
                }
              }
            });
          } catch (error) {
            console.error("❌ Buy transaction failed:", error);
            if (error instanceof Error) {
              // Enhanced error logging
              console.error("Error details:", {
                message: error.message,
                stack: error.stack,
                // Cast error to SolanaError type to access additional properties
                logs: (error as SolanaError).logs || [],
                code: (error as SolanaError).code,
                details: (error as SolanaError).details || {},
              });
            }
          }
        } catch (error) {
          console.error("❌ Error processing log:", error);
        }
      },
      "confirmed"
    );
    
    isListening = true;
    console.log('✅ Token listener started successfully');
  };

  // Function to stop listening
  const stopListening = () => {
    if (!isListening) {
      console.log('🔇 Not currently listening');
      return;
    }
    
    if (logListener) {
      connection.removeOnLogsListener(logListener);
      logListener = null;
    }
    
    isListening = false;
    console.log('🔇 Token listener stopped');
  };

  try {
    // Single WebSocket connection handler for all functionality
    wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 New client connected');

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          console.log('📨 Received message:', data);

          switch (data.type) {
            case 'SET_MODE':
              if (data.mode === 'automatic') {
                botState.isAutoMode = true;
                startListening();
                broadcastUpdate({
                  type: 'MODE_CHANGED',
                  mode: 'automatic',
                  message: 'Bot switched to automatic mode'
                });
              } else if (data.mode === 'manual') {
                botState.isAutoMode = false;
                stopListening();
                broadcastUpdate({
                  type: 'MODE_CHANGED',
                  mode: 'manual',
                  message: 'Bot switched to manual mode'
                });
              }
              break;

            case 'MANUAL_BUY':
              console.log('🛒 Manual buy request received');
              try {
                const { mintAddress, amount, privateKey } = data.data;
                
                // Convert SOL to lamports and adjust amount (divide by 1000)
                const amountInLamports = Math.floor(amount * 1e9); // Convert SOL to lamports
                const adjustedAmount = Math.floor(amountInLamports / 1000); // Adjust amount like in auto mode
                
                console.log(`💰 Original amount: ${amountInLamports} lamports (${amount} SOL)`);
                console.log(`💵 Adjusted amount: ${adjustedAmount} lamports (${adjustedAmount / 1e9} SOL)`);

                // Handle private key
                let secretKeyArray: number[];
                try {
                  // Handle base58 string format
                  if (typeof privateKey === 'string' && !privateKey.startsWith('[')) {
                    // Convert base58 string to Uint8Array
                    const decodedKey = bs58.decode(privateKey);
                    secretKeyArray = Array.from(decodedKey);
                  } else {
                    // Handle JSON array format
                    if (typeof privateKey === 'string') {
                      secretKeyArray = JSON.parse(privateKey);
                    } else if (Array.isArray(privateKey)) {
                      secretKeyArray = privateKey;
                    } else {
                      throw new Error('Invalid private key format');
                    }
                  }

                  // Validate the array length
                  if (!Array.isArray(secretKeyArray) || secretKeyArray.length !== 64) {
                    console.error('❌ Invalid private key length:', secretKeyArray?.length);
                    ws.send(JSON.stringify({
                      type: 'MANUAL_BUY_ERROR',
                      error: 'Invalid private key length. Expected 64 bytes.'
                    }));
                    return;
                  }

                  // Create keypair for balance check
                  const userKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));

                  // Check wallet balance before proceeding
                  const hasEnoughBalance = await checkWalletBalance(
                    getConnection(),
                    userKeypair.publicKey,
                    amountInLamports
                  );

                  if (!hasEnoughBalance) {
                    ws.send(JSON.stringify({
                      type: 'MANUAL_BUY_ERROR',
                      error: 'Insufficient wallet balance. Please add more SOL to your wallet.'
                    }));
                    return;
                  }

                  const result = await handleManualBuy(
                    mintAddress,
                    adjustedAmount,
                    JSON.stringify(secretKeyArray), // Pass the stringified array
                    getConnection(),
                    MEMEHOME_PROGRAM_ID
                  );

                  if (result.success) {
                    console.log('✅ Manual buy successful');
                    ws.send(JSON.stringify({
                      type: 'MANUAL_BUY_SUCCESS',
                      signature: result.signature,
                      details: result.details
                    }));

                    broadcastUpdate({
                      type: 'NEW_TOKEN',
                      tokenData: {
                        mint: mintAddress,
                        status: 'bought',
                        timestamp: Date.now(),
                        signature: result.signature,
                        creator: 'manual-buy',
                        bondingCurve: '',
                        curveTokenAccount: '',
                        userTokenAccount: '',
                        metadata: '',
                        decimals: 9
                      }
                    });
                  } else {
                    console.error('❌ Manual buy failed:', result.error);
                    ws.send(JSON.stringify({
                      type: 'MANUAL_BUY_ERROR',
                      error: result.error || 'Transaction failed'
                    }));
                  }
                } catch (parseError) {
                  console.error('❌ Error parsing private key:', parseError);
                  ws.send(JSON.stringify({
                    type: 'MANUAL_BUY_ERROR',
                    error: 'Invalid private key format. Please provide a valid private key.'
                  }));
                  return;
                }
              } catch (error) {
                console.error('❌ Manual buy error:', error);
                let errorMessage = 'Unknown error occurred';
                
                if (error instanceof Error) {
                  if (error.message.includes('insufficient lamports')) {
                    errorMessage = 'Insufficient SOL balance in wallet';
                  } else if (error.message.includes('custom program error')) {
                    errorMessage = 'Transaction failed: Program error';
                  } else {
                    errorMessage = error.message;
                  }
                }
                
                ws.send(JSON.stringify({
                  type: 'MANUAL_BUY_ERROR',
                  error: errorMessage
                }));
              }
              break;

            case 'RESET_STATE':
              resetBotState();
              break;

            default:
              console.log('⚠️ Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('❌ Error processing message:', error);
          ws.send(JSON.stringify({
            type: 'ERROR',
            error: 'Failed to process message'
          }));
        }
      });

      ws.on('close', () => {
        console.log('🔌 Client disconnected');
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });
    });

  } catch (error) {
    console.error("Error starting bot:", error);
  }
}
import { Connection, PublicKey } from '@solana/web3.js';
import { MemeHomeToken } from '../models/MemeHomeToken';
//import { getCurrentPrice } from '../helper-functions/getCurrentPrice';
import { MEMEHOME_PROGRAM_ID } from '../config/test-config';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import { getSwapAccounts } from '../action/getSwapAccounts';
import { Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Idl } from '@project-serum/anchor';
import BN from 'bn.js';
import bs58 from 'bs58';
import { WebSocketServer } from 'ws';
import { UserToken } from '../models/userToken';

// Define Metaplex Metadata Program ID
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');


const memeHomeIdl = require('../idl/meme_home_idl.json');

export function initProgram(
  connection: Connection,
  walletOrPublicKey: PublicKey 
) {

  const dummyWallet = {
    publicKey: walletOrPublicKey,
    signAllTransactions: async (txs: any) => txs,
    signTransaction: async (tx: any) => tx,
  };
  const provider = new AnchorProvider(connection, dummyWallet as any, { preflightCommitment: 'confirmed' });
  return new Program(memeHomeIdl as Idl, MEMEHOME_PROGRAM_ID, provider);
}

// Helper to get Metaplex metadata PDA from mint
function getMetadataPDA(mint: string): PublicKey {
  // amazonq-ignore-next-line
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      new PublicKey(mint).toBuffer(),
    ],
    METADATA_PROGRAM_ID
  )[0];
}

// Helper: Fetch token metadata (image, etc.) from URI
async function fetchTokenMetadata(uri: string) {
  try {
    const res = await fetch(uri);
    const json = await res.json();
    //console.log('[fetchTokenMetadata] Success:', uri, json);
    return json;
  // amazonq-ignore-next-line
  } catch (e) {
    // amazonq-ignore-next-line
    console.error('[fetchTokenMetadata] Error fetching:', uri, e);
    return {};
  }
}

// Helper: Fetch Metaplex metadata (name, symbol, image, uri)
async function fetchMetaplexMetadata(connection: Connection, mint: string) {
  try {
    const metadataPDA = getMetadataPDA(mint);
    //console.log('[fetchMetaplexMetadata] metadataPDA:', metadataPDA.toBase58());
    const accountInfo = await connection.getAccountInfo(metadataPDA);
    if (!accountInfo) {
      //console.warn('[fetchMetaplexMetadata] No accountInfo for:', metadataPDA.toBase58());
      return {};
    }
    const metadata = Metadata.deserialize(accountInfo.data)[0];
    const uri = metadata.data.uri.replace(/\0/g, '');
    //console.log('[fetchMetaplexMetadata] Fetched URI:', uri);
    const metaJson: any = await fetchTokenMetadata(uri);
    //console.log('[fetchMetaplexMetadata] metaJson:', metaJson);
    return {
      name: metadata.data.name,
      symbol: metadata.data.symbol,
      imageUrl: metaJson?.image || metaJson?.image_url || metaJson?.properties?.image || '',
      metadataUri: uri,
      decimals: metaJson?.decimals // fallback if available
    };
  // amazonq-ignore-next-line
  } catch (err) {
    console.error('[fetchMetaplexMetadata] Error:', err);
    return {};
  }
}

// amazonq-ignore-next-line
async function fetchMetaplexMetadataWithRetry(connection: Connection, mint: string, retries = 10, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    // amazonq-ignore-next-line
    const meta = await fetchMetaplexMetadata(connection, mint);
    if (meta && meta.name !== 'Unknown' && meta.name) return meta;
    await new Promise(res => setTimeout(res, delayMs));
  }
  return { name: 'Unknown', symbol: 'Unknown', imageUrl: '', metadataUri: '', decimals: undefined };
}

export async function getCurrentPriceForWorker(
  connection: Connection,
  mintAddress: string
): Promise<number> {
  try {
    // Use a dummy public key for worker context
    const dummyKey = Keypair.generate().publicKey;
    const swapAccounts = await getSwapAccounts({
      mintAddress,
      buyer: dummyKey,
      connection,
      programId: MEMEHOME_PROGRAM_ID
    });
    if (!swapAccounts) return 0;
    const program = initProgram(connection, dummyKey);
    const bondingCurveAcc: any = await program.account.bondingCurve.fetch(swapAccounts.bondingCurve);
    const virtualSolReserves = bondingCurveAcc['virtualSolReserves'] as BN;
    const virtualTokenReserves = bondingCurveAcc['virtualTokenReserves'] as BN;
    if (!virtualSolReserves || !virtualTokenReserves) return 0;
    const virtualSol = virtualSolReserves.toNumber() / 1_000_000;
    const virtualToken = virtualTokenReserves.toNumber() / 1_000_000;
    // amazonq-ignore-next-line
    if (virtualToken === 0) return 0;
    return virtualSol / virtualToken;
  } catch (error) {
    console.error(`[${mintAddress}] Error getting current price (worker):`, error);
    return 0;
  }
}

async function getCurrentPriceWithRetry(
  connection: Connection,
  mint: string,
  retries = 3,
  delayMs = 1500
): Promise<number> {
  let lastPrice = 0;
  for (let i = 0; i < retries; i++) {
    const price = await getCurrentPriceForWorker(connection, mint);
    if (price !== lastPrice && price > 0) return price;
    lastPrice = price;
    // amazonq-ignore-next-line
    await new Promise(res => setTimeout(res, delayMs));
  }
  return lastPrice;
}

async function getTokenLaunchTimestamp(connection: Connection, mint: string) {
  const programId = process.env.MEMEHOME_PROGRAM_ID;
  if (!programId) {
    console.log('[getTokenLaunchTimestamp] MEMEHOME_PROGRAM_ID not set in env!');
    // amazonq-ignore-next-line
    return Date.now();
  }

  console.log(`[getTokenLaunchTimestamp] Searching for launch tx for mint: ${mint} using programId: ${programId}`);

  const signatures = await connection.getSignaturesForAddress(new PublicKey(programId), { limit: 500 });
 // console.log(`[getTokenLaunchTimestamp] Found ${signatures.length} signatures for programId`);

  for (const sig of signatures) {
    //console.log(`[getTokenLaunchTimestamp] Checking tx: ${sig.signature}`);
    const tx = await connection.getTransaction(sig.signature, { commitment: 'confirmed' });
    if (!tx) {
      // amazonq-ignore-next-line
      console.log(`[getTokenLaunchTimestamp] Transaction not found for signature: ${sig.signature}`);
      continue;
    }
    if (!tx.meta || !tx.meta.logMessages) {
      // amazonq-ignore-next-line
      console.log(`[getTokenLaunchTimestamp] No meta/logMessages for tx: ${sig.signature}`);
      continue;
    }

    //console.log(`[getTokenLaunchTimestamp] logMessages:`, tx.meta.logMessages);

    if (tx.meta.logMessages.some(log => log.includes('Instruction: Launch'))) {
      const accountKeys = tx.transaction.message.accountKeys.map(key => key.toBase58());
      //console.log(`[getTokenLaunchTimestamp] Found 'Instruction: Launch' in tx: ${sig.signature}`);
      //console.log(`[getTokenLaunchTimestamp] Account keys:`, accountKeys);

      if (accountKeys.includes(mint)) {
        //console.log(`[getTokenLaunchTimestamp] Found matching mint in tx: ${sig.signature}`);
        if (tx.blockTime) {
          //console.log(`[getTokenLaunchTimestamp] Returning blockTime: ${tx.blockTime * 1000}`);
          return tx.blockTime * 1000;
        } else {
          //console.log(`[getTokenLaunchTimestamp] No blockTime, using Date.now()`);
          return Date.now();
        }
      } else {
        // amazonq-ignore-next-line
        console.log(`[getTokenLaunchTimestamp] Mint not found in accountKeys for tx: ${sig.signature}`);
      }
    }
  }
  console.log(`[getTokenLaunchTimestamp] No launch tx found for mint: ${mint}, using Date.now()`);
  return Date.now();
}

async function waitForFinalization(connection: Connection, signature: string, maxWaitMs = 20000) {
  const start = Date.now();
  // amazonq-ignore-next-line
  while (Date.now() - start < maxWaitMs) {
    const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
    if (status && status.value && status.value.confirmationStatus === 'finalized') {
      return true;
    }
    await new Promise(res => setTimeout(res, 1000)); // wait 1s before checking again
  }
  return false; // Timed out
}

export async function startMemeHomeTokenWorker(wss: WebSocketServer) {
  const connection = new Connection(process.env.RPC_ENDPOINT!);
  console.log('[MemeHomeTokenWorker] Real-time worker started!');

  connection.onLogs(
    MEMEHOME_PROGRAM_ID,
    async (logInfo) => {
      try {
        // Listen for all relevant events
        const isTokenEvent = logInfo.logs.some(log =>
          log.includes('Instruction: Launch') ||
          log.includes('Instruction: Swap') ||
          log.includes('Instruction: Buy') ||
          log.includes('Instruction: Sell') ||
          log.includes('Instruction: Update')
        );
        if (!isTokenEvent) return;

        const eventType = logInfo.logs.find(log =>
          log.includes('Instruction: Launch') ||
          log.includes('Instruction: Swap') ||
          log.includes('Instruction: Buy') ||
          log.includes('Instruction: Sell') ||
          log.includes('Instruction: Update')
        );
        // amazonq-ignore-next-line
        console.log(`[MemeHomeTokenWorker] Detected event: ${eventType}`);
        //console.log('[MemeHomeTokenWorker] logInfo:', logInfo);

        // 1. Fetch transaction details
        const tx = await connection.getTransaction(logInfo.signature, { commitment: 'confirmed' });
        if (!tx?.transaction?.message) {
          // amazonq-ignore-next-line
          console.warn('[MemeHomeTokenWorker] No transaction message for:', logInfo.signature);
          return;
        }
        // FIX: Declare accountKeys before any use
        const accountKeys = tx.transaction.message.getAccountKeys();
        //console.log('[MemeHomeTokenWorker] Transaction:', tx);
        // Debug: Print all logs
        //console.log('[DEBUG] Transaction logs:', tx.meta?.logMessages);
        // Debug: Print all instructions and their accounts
        tx.transaction.message.instructions.forEach((ix, idx) => {
          //console.log(`[DEBUG] Instruction ${idx}:`, ix);
          //console.log(`[DEBUG] Accounts for instruction ${idx}:`, ix.accounts.map(i => accountKeys.get(i)?.toBase58()));
        });
        //console.log('[DEBUG] All account keys:', accountKeys.staticAccountKeys.map((k: any) => accountKeys.get(k)?.toBase58 ? accountKeys.get(k)?.toBase58() : k));

        // 2. Extract token info from transaction
        // Updated indices as per new IDL
        const creator = accountKeys.get(0)?.toBase58();           // launch: 0
        const bondingCurve = accountKeys.get(3)?.toBase58();      // launch: 3, swap: 3
        const curveTokenAccount = accountKeys.get(4)?.toBase58(); // launch: 4, swap: 5
        const decimalsDefault = 9;

        //console.log('[MemeHomeTokenWorker] Parsed keys:', { creator, bondingCurve, curveTokenAccount });
        //console.log('[MemeHomeTokenWorker] All account keys:', accountKeys.staticAccountKeys.map(k => k.toBase58()));
        //console.log('[MemeHomeTokenWorker] All instructions:', tx.transaction.message.instructions);

        if (!creator) {
          console.warn('[MemeHomeTokenWorker] Skipping log: creator undefined');
          return;
        }

        // 3. Extract mint from instructions
        let mint: string | undefined;
        const instructions = tx.transaction.message.instructions;
        const isLaunch = logInfo.logs.some(log => log.includes('Instruction: Launch'));
        const isSwap = logInfo.logs.some(log => log.includes('Instruction: Swap'));
        const isBuy = logInfo.logs.some(log => log.includes('Instruction: Buy'));
        const isSell = logInfo.logs.some(log => log.includes('Instruction: Sell'));

        for (const ix of instructions) {
          const programId = accountKeys.get(ix.programIdIndex)?.toBase58();
          if (programId === MEMEHOME_PROGRAM_ID.toBase58()) {
            if (isLaunch && ix.accounts.length >= 5) {
              mint = accountKeys.get(ix.accounts[2])?.toBase58(); // Launch: tokenMint at index 2
              //console.log(`[DEBUG] Launch mint extracted: ${mint}`);
              // === SEND TOKEN_DETECTED IMMEDIATELY ===
              if (mint) {
                wss.clients.forEach(client => {
                  if (client.readyState === 1) {
                    client.send(JSON.stringify({ type: 'TOKEN_DETECTED', mint }));
                  }
                });
              }
              break;
            }
            if (isSwap && ix.accounts.length >= 7) {
              mint = accountKeys.get(ix.accounts[4])?.toBase58(); // Swap: tokenMint at index 4
              //console.log(`[DEBUG] Swap mint extracted: ${mint}`);
              break;
            }
            if (isBuy && ix.accounts.length >= 7) {
              mint = accountKeys.get(ix.accounts[4])?.toBase58(); // Buy: tokenMint at index 4 (same as swap)
              //console.log(`[DEBUG] Buy mint extracted: ${mint}`);
              break;
            }
            if (isSell && ix.accounts.length >= 7) {
              mint = accountKeys.get(ix.accounts[4])?.toBase58(); // Sell: tokenMint at index 4 (same as swap)
              //console.log(`[DEBUG] Sell mint extracted: ${mint}`);
              break;
            }
          }
        }
        if (!mint) {
          console.warn('[MemeHomeTokenWorker] Could not determine mint address for event');
          return;
        }

        // 4. Now use mint for SPL, Metaplex, price, etc.
        let name = "Unknown";
        let symbol = "Unknown";
        let decimals = decimalsDefault;
        let imageUrl = '';
        let metadataUri = '';
        let supply = 0; // <-- NEW: numeric supply

        // try {
        //   const tokenAccountInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
        //   // ...
        // } catch (e) { /* ... */ }

        if (name === "Unknown" || symbol === "Unknown") {
          try {
            const meta = await fetchMetaplexMetadataWithRetry(connection, mint);
            name = (meta.name || name).replace(/\0/g, '');
            symbol = (meta.symbol || symbol).replace(/\0/g, '');
            decimals = meta.decimals ?? decimals;
            imageUrl = meta.imageUrl || '';
            metadataUri = meta.metadataUri || '';
          } catch (e) {
            // amazonq-ignore-next-line
            console.error(`❌ [MemeHomeTokenWorker] Error fetching Metaplex meta for mint ${mint}:`, e);
          }
        }

        // --- Fetch supply from on-chain (RAW units, no divide) ---
        let supplyRaw = 0;
        try {
          const tokenSupplyInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
          if (
            tokenSupplyInfo.value &&
            typeof tokenSupplyInfo.value.data === "object" &&
            "parsed" in tokenSupplyInfo.value.data &&
            tokenSupplyInfo.value.data.parsed.info &&
            tokenSupplyInfo.value.data.parsed.info.supply !== undefined
          ) {
            // supply is a string, use as number (RAW, no divide)
            supplyRaw = Number(tokenSupplyInfo.value.data.parsed.info.supply);
          }
        } catch (e) {
          // amazonq-ignore-next-line
          console.error(`[${mint}] Error fetching supply:`, e);
        }

        // --- Fetch bonding curve reserves for marketCap (RAW units, no divide) ---
        let virtualSolRaw = 0;
        let virtualTokenRaw = 0;
        try {
          const dummyKey = Keypair.generate().publicKey;
          const swapAccounts = await getSwapAccounts({
            mintAddress: mint,
            buyer: dummyKey,
            connection,
            programId: MEMEHOME_PROGRAM_ID
          });
          if (swapAccounts) {
            const program = initProgram(connection, dummyKey);
            const bondingCurveAcc: any = await program.account.bondingCurve.fetch(swapAccounts.bondingCurve);
            const virtualSolReserves = bondingCurveAcc['virtualSolReserves'] as BN;
            const virtualTokenReserves = bondingCurveAcc['virtualTokenReserves'] as BN;
            virtualSolRaw = virtualSolReserves.toNumber(); // RAW
            virtualTokenRaw = virtualTokenReserves.toNumber(); // RAW
          }
        } catch (e) {
          // amazonq-ignore-next-line
          console.error(`[${mint}] Error fetching bonding curve reserves:`, e);
        }

        // 5. Try to get current price (but don't fail if error)
        let currentPrice = 0;
        try {
          currentPrice = await getCurrentPriceWithRetry(connection, mint);
        } catch (e) {
          // amazonq-ignore-next-line
          console.error(`[${mint}] Error getting current price:`, e);
        }

        // --- Use getMarketCap for marketCap calculation (RAW units) ---
        let marketCapLamports = 0;
        let marketCap = 0;
        try {
          marketCapLamports = await getMarketCap(supplyRaw, virtualSolRaw, virtualTokenRaw);
          marketCap = marketCapLamports / 1e9; // Convert lamports to SOL
        } catch (e) {
          // amazonq-ignore-next-line
          console.error(`[${mint}] Error calculating marketCap:`, e);
        }
        // --- Calculate marketCapUsd ---
        let marketCapUsd = 0;
        const solPriceUsd = parseFloat(process.env.SOL_PRICE_USD || '0');
        if (solPriceUsd && marketCap) {
          marketCapUsd = marketCap * solPriceUsd;
        }
        console.log('[MarketCap Debug - Upsert]', {
          supplyRaw,
          virtualSolRaw,
          virtualTokenRaw,
          mint,
          marketCapLamports,
          marketCap,
          solPriceUsd,
          marketCapUsd
        });

        // 6. Check if token already exists in DB
        const tokenInDb = await MemeHomeToken.findOne({ mint });
        //console.log(`[MemeHomeTokenWorker] tokenInDb:`, !!tokenInDb);

        // 7. Decide creationTimestamp
        let creationTimestamp;
        if (isLaunch) {
          creationTimestamp = Date.now();
          //console.log(`[MemeHomeTokenWorker] Launch event: using Date.now() for creationTimestamp: ${creationTimestamp}`);
        } else if ((isBuy || isSell || isSwap) && !tokenInDb) {
          // amazonq-ignore-next-line
          console.log('[MemeHomeTokenWorker] Calling getTokenLaunchTimestamp for mint:', mint);
          creationTimestamp = await getTokenLaunchTimestamp(connection, mint);
          // amazonq-ignore-next-line
          console.log(`[MemeHomeTokenWorker] Buy/Sell/Swap event, token not in DB: fetched creationTimestamp: ${creationTimestamp}`);
        } else {
          console.log('[MemeHomeTokenWorker] Not a launch/buy/sell/swap event or token already in DB, not setting creationTimestamp');
        }

        //console.log('[MemeHomeTokenWorker] creationTimestamp value before upsert:', creationTimestamp);
        if (typeof creationTimestamp !== 'number' || isNaN(creationTimestamp)) {
          creationTimestamp = Date.now();
          //console.log('[MemeHomeTokenWorker] Fallback: creationTimestamp set to Date.now()', creationTimestamp);
        }

        // 8. Upsert in DB
        const upsertObj: any = {
          $set: {
            mint,
            name,
            symbol,
            bondingCurve,
            curveTokenAccount,
            decimals,
            currentPrice,
            imageUrl,
            metadataUri,
            creationSignature: logInfo.signature,
            isActive: true,
            lastUpdated: new Date(),
            platform: 'memehome',
            supply: supplyRaw.toString(), // store as string for compatibility
            marketCap, // in SOL
            marketCapUsd // in USD
          },
          $setOnInsert: {
            creationTimestamp,
            creator
          }
        };
        // amazonq-ignore-next-line
        console.log('[MemeHomeTokenWorker] Final upsertObj:', upsertObj);

        await MemeHomeToken.findOneAndUpdate(
          { mint },
          upsertObj,
          { upsert: true }
        );
        // amazonq-ignore-next-line
        console.log(`[MemeHomeTokenWorker] Upserted token: ${mint}`);

        // 9. Swap/Buy/Sell event: update volume/transactions
        if (logInfo.logs.some(log => log.includes('Instruction: Buy')) || logInfo.logs.some(log => log.includes('Instruction: Sell'))) {
          const swapIx = instructions.find(ix => {
            const programId = accountKeys.get(ix.programIdIndex)?.toBase58();
            return programId === MEMEHOME_PROGRAM_ID.toBase58() && ix.accounts.length >= 5;
          });
          if (swapIx) {
            const data = Buffer.from(bs58.decode(swapIx.data));
            const amount = data.readBigUInt64LE(0);
            await MemeHomeToken.findOneAndUpdate(
              { mint },
              {
                $inc: {
                  totalTransactions: 1,
                  totalVolume: Number(amount)
                },
                $set: {
                  currentPrice,
                  lastUpdated: new Date()
                }
              }
            );
          }
        }

        // 10. WebSocket broadcast
        const latestToken = await MemeHomeToken.findOne({ mint }).lean();
        if (latestToken) {
          let eventType = '';
          if (isLaunch) eventType = 'launch';
          else if (isSwap) eventType = 'swap';
          else if (isBuy) eventType = 'buy';
          else if (isSell) eventType = 'sell';
          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              client.send(JSON.stringify({ type: 'NEW_TOKEN', token: latestToken, eventType }));
            }
          });
        }

        if (isLaunch && mint) {
          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              client.send(JSON.stringify({ type: 'TOKEN_DETECTED', mint }));
            }
          });
        }

        if (isBuy || isSell || isSwap) {
          // Wait for block finalization
          waitForFinalization(connection, logInfo.signature).then(async (finalized) => {
            if (finalized) {
              const price = await getCurrentPriceForWorker(connection, mint);
              await MemeHomeToken.updateOne(
                { mint },
                { $set: { currentPrice: price, lastUpdated: new Date() } }
              );
              console.log(`[BlockConfirmedPriceUpdate] Updated price for ${mint}: ${price}`);

              // WebSocket broadcast for frontend update
              const latestToken = await MemeHomeToken.findOne({ mint }).lean();
              if (latestToken) {
                wss.clients.forEach(client => {
                  if (client.readyState === 1) {
                    client.send(JSON.stringify({ type: 'NEW_TOKEN', token: latestToken }));
                  }
                });
              }
            } else {
              // amazonq-ignore-next-line
              console.warn(`[BlockConfirmedPriceUpdate] Transaction ${logInfo.signature} not finalized in time, skipping price update.`);
            }
          });
        }
      // amazonq-ignore-next-line
      } catch (err) {
        console.error('[MemeHomeTokenWorker] Error:', err);
      }
    },
    'confirmed'
  );

  // Run once at server start
  periodicPriceSync(wss);

  // Then run every 10 minutes
  setInterval(() => periodicPriceSync(wss), 10 * 60 * 1000);
}

const connection = new Connection(process.env.RPC_ENDPOINT!);

async function periodicPriceSync(wss: WebSocketServer) {
  const tokens = await MemeHomeToken.find({});
  const BATCH_SIZE = 3;
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (token) => {
      try {
        // --- Fetch bonding curve reserves for marketCap (RAW units) ---
        let virtualSolRaw = 0;
        let virtualTokenRaw = 0;
        try {
          const dummyKey = Keypair.generate().publicKey;
          const swapAccounts = await getSwapAccounts({
            mintAddress: token.mint,
            buyer: dummyKey,
            connection,
            programId: MEMEHOME_PROGRAM_ID
          });
          if (swapAccounts) {
            const program = initProgram(connection, dummyKey);
            const bondingCurveAcc: any = await program.account.bondingCurve.fetch(swapAccounts.bondingCurve);
            const virtualSolReserves = bondingCurveAcc['virtualSolReserves'] as BN;
            const virtualTokenReserves = bondingCurveAcc['virtualTokenReserves'] as BN;
            virtualSolRaw = virtualSolReserves.toNumber(); // RAW
            virtualTokenRaw = virtualTokenReserves.toNumber(); // RAW
          }
        } catch (e) {
          // amazonq-ignore-next-line
          console.error(`[${token.mint}] Error fetching bonding curve reserves:`, e);
        }
        let price = 0;
        try {
          price = await getCurrentPriceForWorker(connection, token.mint);
        } catch (e) {
          // amazonq-ignore-next-line
          console.error(`[${token.mint}] Error getting current price:`, e);
        }
        let supplyRaw = 0;
        if (token.supply) {
          supplyRaw = Number(token.supply);
        }
        let marketCapLamports = 0;
        let marketCap = 0;
        try {
          marketCapLamports = await getMarketCap(supplyRaw, virtualSolRaw, virtualTokenRaw);
          marketCap = marketCapLamports / 1e9; // Convert lamports to SOL
        } catch (e) {
          // amazonq-ignore-next-line
          console.error(`[${token.mint}] Error calculating marketCap:`, e);
        }
        // --- Calculate marketCapUsd ---
        let marketCapUsd = 0;
        const solPriceUsd = parseFloat(process.env.SOL_PRICE_USD || '0');
        if (solPriceUsd && marketCap) {
          marketCapUsd = marketCap * solPriceUsd;
        }
        console.log('[MarketCap Debug - Sync]', {
          supplyRaw,
          virtualSolRaw,
          virtualTokenRaw,
          mint: token.mint,
          marketCapLamports,
          marketCap,
          solPriceUsd,
          marketCapUsd
        });
        await MemeHomeToken.updateOne(
          { mint: token.mint },
          { $set: { currentPrice: price, lastUpdated: new Date(), marketCap, marketCapUsd } }
        );
        // --- NEW: Update all UserToken docs for this mint ---
        await UserToken.updateMany(
          { mint: token.mint },
          { $set: { currentPrice: price, lastUpdated: new Date() } }
        );
        // --- END NEW ---
        // amazonq-ignore-next-line
        console.log(`[PeriodicPriceSync] Updated price for ${token.mint}: ${price}`);
        // WebSocket broadcast for frontend update
        const latestToken = await MemeHomeToken.findOne({ mint: token.mint }).lean();
        if (latestToken) {
          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              client.send(JSON.stringify({ type: 'NEW_TOKEN', token: latestToken }));
            }
          });
        }
      // amazonq-ignore-next-line
      } catch (e) {
        // amazonq-ignore-next-line
        console.error(`[PeriodicPriceSync] Error updating price for ${token.mint}:`, e);
      }
    }));
    if (i + BATCH_SIZE < tokens.length) {
      console.log(`[PeriodicPriceSync] Waiting 2 seconds before next batch...`);
      await new Promise(res => setTimeout(res, 2000));
    }
  }
}

export const getMarketCap = async(
    tokenTotalSupply: number,
    virtualSolReserves: number,
    virtualTokenReserves: number,
) => {
    if(virtualTokenReserves === 0){
        return 0;
    }
    return Math.floor((tokenTotalSupply * virtualSolReserves) / virtualTokenReserves);
}
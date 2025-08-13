import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Idl } from '@project-serum/anchor';
import { WebSocketServer } from 'ws';
import { PumpFunToken } from '../models/PumpFunToken';
import { getPumpFunPrice } from './pumpFunPriceCalculator';
import { getPumpFunVolume } from './pumpFunVolumeCalculator';

const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const pumpFunIdl = require('../idl/pump_fun_idl.json');

// Function to get bonding curve progress by mint address
async function getBondingCurveProgress(connection: Connection, program: Program, mintAddress: string): Promise<number> {
  try {
    const mint = new PublicKey(mintAddress);
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mint.toBuffer()],
      PUMP_FUN_PROGRAM_ID
    );
    
    const bondingCurveData: any = await program.account.bondingCurve.fetch(bondingCurve);
    const realSolReserves = bondingCurveData.realSolReserves.toNumber();
    const TARGET_SOL_FOR_COMPLETION = 85;
    
    const progress = Math.min((realSolReserves / 1e9 / TARGET_SOL_FOR_COMPLETION) * 100, 100);
    return parseFloat(progress.toFixed(2));
  } catch (error) {
    return 0;
  }
}

// Function to get holder stats from Moralis API
async function getHolderStats(mintAddress: string) {
  try {
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'X-API-Key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImQyN2U5MWIyLTViZDItNGVkZi04YjEzLTQ0NGYxMGUxYjAxOSIsIm9yZ0lkIjoiNDQ4NDg4IiwidXNlcklkIjoiNDYxNDM5IiwidHlwZUlkIjoiMjU1YzE3ZjQtZmRkOS00YTFmLWI2YjktODE5MDQyZWE4OGJhIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDc5MDAyMDMsImV4cCI6NDkwMzY2MDIwM30.mHDmaLxjZgvfvYR8DQmWzCY4Gf8Q12Fc5VlVgxXyWSc'
      }
    };
    
    const response = await fetch(`https://solana-gateway.moralis.io/token/mainnet/holders/${mintAddress}`, options);
    const data: any = await response.json();
    
    return {
      totalHolders: data.totalHolders || 0,
      holderChange24h: data.holderChange?.['24h']?.change || 0,
      holderChangePercent24h: data.holderChange?.['24h']?.changePercent || 0,
      whales: data.holderDistribution?.whales || 0,
      sharks: data.holderDistribution?.sharks || 0,
      dolphins: data.holderDistribution?.dolphins || 0,
      top10SupplyPercent: data.holderSupply?.top10?.supplyPercent || 0
    };
  } catch (error) {
    console.log('[PumpFunTokenWorker] Holder stats fetch failed');
    return {
      totalHolders: 0,
      holderChange24h: 0,
      holderChangePercent24h: 0,
      whales: 0,
      sharks: 0,
      dolphins: 0,
      top10SupplyPercent: 0
    };
  }
}

// Function to get token analytics from PumpFun bonding curve
async function getTokenAnalytics(mintAddress: string, connection: Connection, program: Program) {
  try {
    // Get price and market cap from bonding curve
    const priceData = await getPumpFunPrice(connection, program, mintAddress);
    
    // Get volume from transaction history
    const volumeData = await getPumpFunVolume(connection, mintAddress);
    
    if (priceData && volumeData) {
      return {
        buys: volumeData.buys24h,
        sells: volumeData.sells24h,
        totalTransactions: volumeData.totalTransactions,
        volume: volumeData.volume24hUsd,
        priceChange: 0, // Would need historical data
        marketCap: priceData.marketCap,
        priceUsd: priceData.priceInUsd,
        priceNative: priceData.priceInSol
      };
    }
  } catch (error) {
    console.log('[PumpFunTokenWorker] Price/Volume calculation failed:', error);
  }
  
  return {
    buys: 0,
    sells: 0,
    totalTransactions: 0,
    volume: 0,
    priceChange: 0,
    marketCap: 0,
    priceUsd: 0,
    priceNative: 0
  };
}

// Function to build initial token metadata (without holder stats)
async function buildInitialTokenMetadata(event: any, connection: Connection, program: Program) {
  const name = event.name;
  const symbol = event.symbol;
  const mint = event.mint.toBase58();
  const creator = event.user.toBase58();
  const metadataUri = event.uri;
  const createdAt = new Date();
  const pumpLink = `https://pump.fun/${mint}`;
  
  // Fetch metadata from URI
  let description = '';
  let image = '';
  let website = '';
  let twitter = '';
  let telegram = '';
  
  try {
    const response = await fetch(metadataUri);
    const metadata: any = await response.json();
    console.log('[PumpFunTokenWorker] Raw Metadata:', JSON.stringify(metadata, null, 2));
    
    description = metadata.description || '';
    image = metadata.image || '';
    website = metadata.website || '';
    twitter = metadata.twitter || '';
    telegram = metadata.telegram || '';
  } catch (error) {
    console.log('[PumpFunTokenWorker] Metadata fetch failed');
  }
  
  // Get total supply from bonding curve
  let totalSupply = 0;
  let totalSupplyFormatted = '0';
  
  try {
    const bondingCurveData: any = await program.account.bondingCurve.fetch(event.bondingCurve);
    totalSupply = bondingCurveData.tokenTotalSupply.toNumber();
    totalSupplyFormatted = (totalSupply / 1e6).toFixed(0) + 'M';
  } catch (error) {
    console.log('[PumpFunTokenWorker] Bonding curve fetch failed');
  }
  
  // Get bonding curve progress
  const bondingCurveProgress = await getBondingCurveProgress(connection, program, mint);
  
  // Get token analytics from bonding curve
  const tokenAnalytics = await getTokenAnalytics(mint, connection, program);
  
  return {
    metadata: {
      name,
      symbol,
      description,
      image,
      website,
      twitter,
      telegram,
      pumpLink,
      decimal: 6,
      totalSupply,
      totalSupplyFormatted,
      mint,
      creator,
      createdAt,
      verified: false
    },
    bondingCurveProgress: {
      bondingCurveProgress,
      position: undefined
    },
    holderStats: {
      totalHolders: 0,
      holderChange24h: 0,
      holderChangePercent24h: 0,
      whales: 0,
      sharks: 0,
      dolphins: 0,
      top10SupplyPercent: 0
    },
    tokenAnalytics
  };
}

// Function to update holder stats after delay
async function updateHolderStats(mint: string, wss: WebSocketServer) {
  console.log(`[PumpFunTokenWorker] Fetching holder stats for ${mint} after 5s delay...`);
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const holderStats = await getHolderStats(mint);
  
  // Update in database
  await PumpFunToken.findOneAndUpdate(
    { 'metadata.mint': mint },
    { $set: { holderStats } }
  );
  
  console.log(`[PumpFunTokenWorker] ✅ Holder stats updated for ${mint}:`, holderStats);
  
  // Send update to WebSocket clients
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'TOKEN_HOLDER_UPDATE',
        mint,
        holderStats
      }));
    }
  });
}

// Function to process token with retry mechanism
async function processTokenWithRetry(event: any, connection: Connection, program: Program, wss: WebSocketServer, maxRetries = 3) {
  const mint = event.mint.toBase58();
  
  // Check if token already exists in database
  const existingToken = await PumpFunToken.findOne({ 'metadata.mint': mint });
  if (existingToken) {
    console.log(`[PumpFunTokenWorker] Token ${mint} already exists in database, skipping...`);
    return;
  }
  
  // Remove delay - fetch data immediately
  console.log(`[PumpFunTokenWorker] Processing token immediately...`);
  
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`[PumpFunTokenWorker] Processing attempt ${attempt}/${maxRetries} for ${mint}`);
      
      // Build initial token data (without holder stats)
      const tokenData = await buildInitialTokenMetadata(event, connection, program);
      
      console.log('[PumpFunTokenWorker] ✅ Token Data Ready:');
      console.log('  Name:', tokenData.metadata.name);
      console.log('  Symbol:', tokenData.metadata.symbol);
      console.log('  Mint:', tokenData.metadata.mint);
      console.log('  Total Supply:', tokenData.metadata.totalSupplyFormatted);
      console.log('  Bonding Curve Progress:', tokenData.bondingCurveProgress.bondingCurveProgress + '%');
      console.log('  Total Holders:', tokenData.holderStats.totalHolders);
      console.log('  Market Cap:', tokenData.tokenAnalytics.marketCap);
      console.log('  Volume:', tokenData.tokenAnalytics.volume);
      
      // Save to database
      const newToken = new PumpFunToken(tokenData);
      await newToken.save();
      console.log('[PumpFunTokenWorker] 💾 Token saved to database!');
      
      // Send to WebSocket clients immediately
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'NEW_PUMPFUN_TOKEN',
            data: tokenData
          }));
        }
      });
      console.log('[PumpFunTokenWorker] 📡 Token sent to WebSocket clients!');
      
      // Update holder stats after 5 seconds (async)
      updateHolderStats(mint, wss).catch(err => 
        console.error('[PumpFunTokenWorker] Holder stats update failed:', err)
      );
      
      return; // Success, exit retry loop
      
    } catch (error) {
      console.error(`[PumpFunTokenWorker] Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        console.log(`[PumpFunTokenWorker] Retrying immediately...`);
      } else {
        console.error(`[PumpFunTokenWorker] All ${maxRetries} attempts failed for ${mint}`);
      }
    }
  }
}

export async function startPumpFunTokenWorker(wss: WebSocketServer) {
  const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=d70232c8-cb8c-4fb0-9d3f-985fc6f90880');
  // const connection = new Connection('https://api.mainnet-beta.solana.com/');
  console.log('[PumpFunTokenWorker] Real-time worker started!');

  let tokenCount = 0;
  const MAX_TOKENS = 100;

  const dummyWallet = {
    publicKey: new PublicKey('11111111111111111111111111111112'),
    signAllTransactions: async (txs: any) => txs,
    signTransaction: async (tx: any) => tx,
  };
  const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: 'confirmed' });
  const program = new Program(pumpFunIdl as Idl, PUMP_FUN_PROGRAM_ID, provider);

  console.log(`[PumpFunTokenWorker] Listening for CreateEvent... (Max ${MAX_TOKENS} tokens)`);

  program.addEventListener('CreateEvent', async (event: any, slot: number) => {
    try {
      if (tokenCount >= MAX_TOKENS) {
        console.log(`[PumpFunTokenWorker] ℹ️ Reached limit of ${MAX_TOKENS} tokens. Worker stopped to save API calls.`);
        return;
      }

      tokenCount++;
      console.log(`[PumpFunTokenWorker] 🚀 NEW TOKEN CREATED! (${tokenCount}/${MAX_TOKENS})`);
      
      // Process token with retry mechanism
      await processTokenWithRetry(event, connection, program, wss);
      
      if (tokenCount >= MAX_TOKENS) {
        console.log(`[PumpFunTokenWorker] ✅ Completed processing ${MAX_TOKENS} tokens. Worker stopped.`);
      }
      
      console.log('----------------------------\n');
      
    } catch (err) {
      console.error('[PumpFunTokenWorker] Error:', err);
    }
  });
}
import { Connection, Keypair } from '@solana/web3.js';
import { WalletToken } from '../models/WalletToken';
import { TokenPrice } from '../models/TokenPrice';
import { getConnection } from '../utils/getProvider';
import { getSwapAccounts } from '../action/getSwapAccounts';
import { MEMEHOME_PROGRAM_ID, USER_SECRET_KEY } from '../config/test-config';
import { Program, AnchorProvider, BN, Idl } from '@project-serum/anchor';
import idl from '../idl/meme_home_idl.json';

// Create userKeypair from secret key
const secret = 
  typeof process.env.USER_SECRET_KEY === 'string' && process.env.USER_SECRET_KEY.length > 0
    ? process.env.USER_SECRET_KEY
    : (typeof USER_SECRET_KEY === 'string'
        ? USER_SECRET_KEY
        : JSON.stringify(USER_SECRET_KEY));

const userKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret || '[]')));

// Helper function for delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize Anchor program
function initProgram(connection: Connection): Program {
  const provider = new AnchorProvider(
    connection,
    { publicKey: userKeypair.publicKey, signTransaction: () => Promise.resolve(null) } as any,
    { commitment: 'confirmed' }
  );
  
  return new Program(idl as Idl, MEMEHOME_PROGRAM_ID, provider);
}

// Get current price using Anchor's account fetch
async function getCurrentPrice(connection: Connection, mintAddress: string): Promise<number> {
  try {
    const swapAccounts = await getSwapAccounts({
      mintAddress,
      buyer: userKeypair.publicKey,
      connection,
      programId: MEMEHOME_PROGRAM_ID
    });

    if (!swapAccounts) return 0;

    const program = initProgram(connection);
    const bondingCurveAcc: any = await program.account.bondingCurve.fetch(swapAccounts.bondingCurve);

    const virtualSolReserves = bondingCurveAcc['virtualSolReserves'] as BN;
    const virtualTokenReserves = bondingCurveAcc['virtualTokenReserves'] as BN;

    if (!virtualSolReserves || !virtualTokenReserves) return 0;

    const virtualSol = virtualSolReserves.toNumber() / 1_000_000;
    const virtualToken = virtualTokenReserves.toNumber() / 1_000_000;

    if (virtualToken === 0) return 0;

    return virtualSol / virtualToken;
  } catch (error) {
    return 0;
  }
}

// Batch price updater
async function updatePrices() {
  const connection = getConnection();
  try {
    const tokens = await WalletToken.distinct('mint');
    const BATCH_SIZE = 3;
    const DELAY_BETWEEN_BATCHES = 3000;

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (mint) => {
        try {
          const currentPrice = await getCurrentPrice(connection, mint);
          await TokenPrice.findOneAndUpdate(
            { mint },
            { $set: { currentPrice, lastUpdated: new Date() } },
            { upsert: true }
          );
        } catch (error) {
          // No logging for individual token errors
        }
      }));

      if (i + BATCH_SIZE < tokens.length) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }
  } catch (error) {
    // No logging for update cycle errors
  }
}

// Start the price update service with minimal logging
export function startPriceUpdateService(interval: number = 10000) {
  console.log(`\n🚀 Price update service started with ${interval / 1000}s interval`);
  let stopped = false;
  let timeoutId: NodeJS.Timeout;

  const run = async () => {
    if (stopped) return;
    
    // Log 1: Cycle starting
    console.log(`\n🔄 Starting price update cycle at ${new Date().toLocaleTimeString()}`);
    
    try {
      await updatePrices();
      
      // Log 2: Cycle completed
      console.log(`✅ Price update cycle completed at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      // No error logging
    }
    
    if (!stopped) {
      timeoutId = setTimeout(run, interval);
    }
  };

  run();

  return () => {
    stopped = true;
    clearTimeout(timeoutId);
    
    // Log 3: Service stopped
    console.log("\n⏹️ Price update service stopped");
  };
}
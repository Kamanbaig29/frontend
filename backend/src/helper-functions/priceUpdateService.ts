import { Connection, Keypair } from '@solana/web3.js';
import { WalletToken } from '../models/WalletToken';
import { TokenPrice } from '../models/TokenPrice';
import { getConnection } from '../utils/getProvider';
import { getSwapAccounts } from '../action/getSwapAccounts';
import { MEMEHOME_PROGRAM_ID, USER_SECRET_KEY } from '../config/test-config';

// Create userKeypair from secret key
const secret =
  typeof process.env.USER_SECRET_KEY === 'string' && process.env.USER_SECRET_KEY.length > 0
    ? process.env.USER_SECRET_KEY
    : (typeof USER_SECRET_KEY === 'string'
        ? USER_SECRET_KEY
        : JSON.stringify(USER_SECRET_KEY));

const userKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret || '[]')));

// Bonding curve price calculation
function calculateAmountOut(
    amountIn: bigint,
    tokenReserve: bigint,
    solReserve: bigint,
    feeNumerator = 997n,
    feeDenominator = 1000n
): bigint {
    const amountInWithFee = amountIn * feeNumerator;
    const numerator = amountInWithFee * solReserve;
    const denominator = tokenReserve * feeDenominator + amountInWithFee;
    return denominator === 0n ? 0n : numerator / denominator;
}

// Get current price for a token using bonding curve
async function getCurrentPrice(connection: Connection, mintAddress: string): Promise<number | null> {
    try {
        const swapAccounts = await getSwapAccounts({
            mintAddress,
            buyer: userKeypair.publicKey,
            connection,
            programId: MEMEHOME_PROGRAM_ID
        });
        if (!swapAccounts) return null;

        // Get token reserves
        const tokenVaultInfo = await connection.getTokenAccountBalance(swapAccounts.curveTokenAccount);
        const tokenReserve = BigInt(tokenVaultInfo.value.amount);

        // Get SOL reserves
        const bondingCurveInfo = await connection.getAccountInfo(swapAccounts.bondingCurve);
        if (!bondingCurveInfo) return null;
        const solReserve = BigInt(bondingCurveInfo.lamports);

        // Calculate price for 1 token
        const oneToken = BigInt(1_000_000_000); // 1 token in lamports (9 decimals)
        const solAmount = calculateAmountOut(oneToken, tokenReserve, solReserve);

        return Number(solAmount) / 1_000_000_000; // Convert to SOL
    } catch (error) {
        if (error instanceof Error && error.message.includes('429')) {
            // Rate limit error, handled in updatePrices
            throw error;
        }
        console.error(`Error getting price for ${mintAddress}:`, error);
        return null;
    }
}

// Helper function for delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Batch price updater with exponential backoff and skip on repeated 429s
async function updatePrices() {
    const connection = getConnection();
    console.log("🔄 Starting price update cycle...");

    try {
        const tokens = await WalletToken.find().select('mint buyPrice');
        console.log(`📊 Found ${tokens.length} tokens to update`);

        const BATCH_SIZE = 1;
        const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

        for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            const batch = tokens.slice(i, i + BATCH_SIZE);

            for (const token of batch) {
                let success = false;
                let retries = 0;
                let delay = DELAY_BETWEEN_REQUESTS;

                while (!success && retries < 3) {
                    try {
                        const currentPrice = await getCurrentPrice(connection, token.mint);
                        if (currentPrice !== null) {
                            await TokenPrice.findOneAndUpdate(
                                { mint: token.mint },
                                {
                                    $set: {
                                        currentPrice,
                                        buyPrice: token.buyPrice || 0,
                                        lastUpdated: new Date()
                                    }
                                },
                                { upsert: true }
                            );
                            console.log(`✅ Updated price for ${token.mint}: ${currentPrice} SOL`);
                        }
                        success = true;
                    } catch (err: any) {
                        if (err.message && err.message.includes('429')) {
                            retries++;
                            console.warn(`429 error, skipping token after ${retries} retries.`);
                            await sleep(delay);
                            delay *= 2; // Exponential backoff
                        } else {
                            console.error(`❌ Error updating price for ${token.mint}:`, err);
                            break;
                        }
                    }
                }
            }
        }
        console.log("✅ Price update cycle completed");
    } catch (error) {
        console.error("❌ Error in price update cycle:", error);
    }
}

// Start the price update service
export function startPriceUpdateService(interval: number = 300000) { // 5 min
    console.log(`🚀 Starting price update service with ${interval}ms interval`);
    updatePrices();
    const intervalId = setInterval(updatePrices, interval);
    return () => {
        clearInterval(intervalId);
        console.log("⏹️ Price update service stopped");
    };
}
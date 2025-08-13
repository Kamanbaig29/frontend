import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Idl } from '@project-serum/anchor';
import { PumpFunToken } from '../models/PumpFunToken';
import { getPumpFunPrice } from './pumpFunPriceCalculator';
import { getPumpFunVolume } from './pumpFunVolumeCalculator';

const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const pumpFunIdl = require('../idl/pump_fun_idl.json');

export async function updateExistingTokenPrices() {
  const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=d70232c8-cb8c-4fb0-9d3f-985fc6f90880');
  // const connection = new Connection('https://api.mainnet-beta.solana.com/');
  
  const dummyWallet = {
    publicKey: new PublicKey('11111111111111111111111111111112'),
    signAllTransactions: async (txs: any) => txs,
    signTransaction: async (tx: any) => tx,
  };
  const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: 'confirmed' });
  const program = new Program(pumpFunIdl as Idl, PUMP_FUN_PROGRAM_ID, provider);

  console.log('[UpdateTokens] Starting price update for existing tokens...');

  // Get all tokens with marketCap = 0
  const tokensToUpdate = await PumpFunToken.find({ 
    'tokenAnalytics.marketCap': { $lte: 0 } 
  }).limit(5); // Update only 5 tokens at a time

  console.log(`[UpdateTokens] Found ${tokensToUpdate.length} tokens to update`);

  for (const token of tokensToUpdate) {
    try {
      console.log(`[UpdateTokens] Updating ${token.metadata.name} (${token.metadata.mint})`);
      
      // Get price and market cap from bonding curve
      const priceData = await getPumpFunPrice(connection, program, token.metadata.mint);
      
      // Get volume from transaction history
      const volumeData = await getPumpFunVolume(connection, token.metadata.mint);
      
      if (priceData && volumeData) {
        const updatedAnalytics = {
          buys: volumeData.buys24h,
          sells: volumeData.sells24h,
          totalTransactions: volumeData.totalTransactions,
          volume: volumeData.volume24hUsd,
          priceChange: 0,
          marketCap: priceData.marketCap,
          priceUsd: priceData.priceInUsd,
          priceNative: priceData.priceInSol
        };

        await PumpFunToken.findByIdAndUpdate(token._id, {
          $set: { tokenAnalytics: updatedAnalytics }
        });

        console.log(`[UpdateTokens] ✅ Updated ${token.metadata.name}: MC=$${priceData.marketCap.toFixed(0)}, Vol=$${volumeData.volume24hUsd.toFixed(0)}`);
      }
    } catch (error) {
      console.error(`[UpdateTokens] Failed to update ${token.metadata.mint}:`, error);
    }
  }

  console.log('[UpdateTokens] ✅ Price update completed!');
}
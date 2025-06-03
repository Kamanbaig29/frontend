import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';

export async function getTokenPrice(mintAddress: string): Promise<number | null> {
  try {
    // Use Jupiter v2 price API
    const response = await axios.get(
      `https://lite-api.jup.ag/price/v2?ids=${mintAddress},So11111111111111111111111111111111111111112`
    );
    
    if (response.data?.[mintAddress]?.price) {
      return response.data[mintAddress].price;
    }

    // If Jupiter v2 fails, try getting recent transactions for price info
    const connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com');
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(mintAddress),
      { limit: 1 }
    );

    if (signatures.length > 0) {
      const tx = await connection.getTransaction(signatures[0].signature);
      if (tx?.meta?.preBalances && tx?.meta?.postBalances) {
        const balanceDiff = Math.abs(tx.meta.preBalances[0] - tx.meta.postBalances[0]);
        return balanceDiff / 1e9; // Convert lamports to SOL
      }
    }
    
    return null;
  } catch (error) {
    console.log(`⚠️ Could not fetch price for: ${mintAddress}`);
    return null;
  }
}

// Helper function to format numbers
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(num);
}

// Helper function to format SOL amounts
export function formatSOL(amount: number, decimals: number = 6): string {
  return `${formatNumber(amount / Math.pow(10, decimals))} SOL`;
}
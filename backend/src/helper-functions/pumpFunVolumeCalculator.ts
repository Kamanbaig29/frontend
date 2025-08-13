import { Connection, PublicKey } from '@solana/web3.js';

// Calculate 24h volume from transaction history
export async function getPumpFunVolume(connection: Connection, mintAddress: string) {
  try {
    const mint = new PublicKey(mintAddress);
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mint.toBuffer()],
      new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')
    );
    
    // Get transaction signatures for last 24 hours
    const signatures = await connection.getSignaturesForAddress(bondingCurve, {
      limit: 1000
    });
    
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    let volume24h = 0;
    let buys = 0;
    let sells = 0;
    
    for (const sig of signatures) {
      if (sig.blockTime && sig.blockTime * 1000 < oneDayAgo) break;
      
      try {
        const tx = await connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        });
        
        if (tx?.meta?.preBalances && tx?.meta?.postBalances) {
          // Calculate SOL amount transferred
          const solTransferred = Math.abs(
            (tx.meta.postBalances[0] - tx.meta.preBalances[0]) / 1e9
          );
          
          if (solTransferred > 0) {
            volume24h += solTransferred;
            
            // Determine if buy or sell based on SOL flow
            if (tx.meta.postBalances[0] > tx.meta.preBalances[0]) {
              sells++;
            } else {
              buys++;
            }
          }
        }
      } catch (error) {
        // Skip failed transactions
        continue;
      }
    }
    
    // Convert to USD
    const solPriceUsd = await getSolPrice();
    const volumeUsd = volume24h * solPriceUsd;
    
    return {
      volume24hSol: volume24h,
      volume24hUsd: volumeUsd,
      buys24h: buys,
      sells24h: sells,
      totalTransactions: buys + sells
    };
  } catch (error) {
    console.error('Volume calculation failed:', error);
    return {
      volume24hSol: 0,
      volume24hUsd: 0,
      buys24h: 0,
      sells24h: 0,
      totalTransactions: 0
    };
  }
}

async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data: any = await response.json();
    return data.solana.usd;
  } catch {
    return 150;
  }
}
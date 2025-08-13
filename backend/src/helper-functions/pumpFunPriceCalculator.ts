import { Connection, PublicKey } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';

// PumpFun bonding curve price calculation
export async function getPumpFunPrice(connection: Connection, program: Program, mintAddress: string) {
  try {
    const mint = new PublicKey(mintAddress);
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mint.toBuffer()],
      new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')
    );
    
    const bondingCurveData: any = await program.account.bondingCurve.fetch(bondingCurve);
    
    // PumpFun bonding curve formula
    const virtualSolReserves = bondingCurveData.virtualSolReserves.toNumber() / 1e9;
    const virtualTokenReserves = bondingCurveData.virtualTokenReserves.toNumber() / 1e6;
    const realSolReserves = bondingCurveData.realSolReserves.toNumber() / 1e9;
    const realTokenReserves = bondingCurveData.realTokenReserves.toNumber() / 1e6;
    
    // Current price = SOL reserves / Token reserves
    const priceInSol = virtualSolReserves / virtualTokenReserves;
    
    // Get SOL price in USD (you can cache this)
    const solPriceUsd = await getSolPrice();
    const priceInUsd = priceInSol * solPriceUsd;
    
    // Market cap = price * total supply
    const totalSupply = bondingCurveData.tokenTotalSupply.toNumber() / 1e6;
    const marketCap = priceInUsd * totalSupply;
    
    return {
      priceInSol,
      priceInUsd,
      marketCap,
      totalSupply,
      realSolReserves,
      realTokenReserves,
      bondingCurveProgress: Math.min((realSolReserves / 85) * 100, 100) // 85 SOL = 100%
    };
  } catch (error) {
    console.error('Price calculation failed:', error);
    return null;
  }
}

// Get SOL price from CoinGecko
async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data: any = await response.json();
    return data.solana.usd;
  } catch {
    return 150; // Fallback price
  }
}
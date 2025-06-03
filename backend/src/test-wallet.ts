import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Metaplex } from "@metaplex-foundation/js";
import axios from 'axios';
require('dotenv').config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com';

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(num);
}

function formatSOL(amount: number, decimals: number = 6): string {
  return `${formatNumber(amount / Math.pow(10, decimals))} SOL`;
}

async function getTokenPrice(mintAddress: string): Promise<number | null> {
       try {
    // Use Jupiter v2 price API
    const response = await axios.get(
      `https://lite-api.jup.ag/price/v2?ids=${mintAddress},So11111111111111111111111111111111111111112`
    );
    
    if (response.data?.[mintAddress]?.price) {
      return response.data[mintAddress].price;
    }

    // If Jupiter v2 fails, try getting recent transactions for price info
    const connection = new Connection(RPC_ENDPOINT);
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

async function getWalletTokens() {
  try {
    const connection = new Connection(RPC_ENDPOINT);
    const metaplex = new Metaplex(connection);
    
    if (!process.env.BUYER_PUBLIC_KEY) {
      throw new Error('BUYER_PUBLIC_KEY not found in environment variables');
    }
    
    const walletPublicKey = new PublicKey(process.env.BUYER_PUBLIC_KEY);

    console.log('🔗 Connected to:', RPC_ENDPOINT);
    console.log('👛 Wallet:', walletPublicKey.toBase58());
    console.log('🔍 Fetching wallet tokens...\n');

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    if (tokenAccounts.value.length === 0) {
      console.log('❌ No tokens found in wallet');
      return;
    }

    console.log(`Found ${tokenAccounts.value.length} tokens, showing first 2:\n`);

    // Take only first 2 tokens
    const firstTwoTokens = tokenAccounts.value.slice(0, 2);

    for (const account of firstTwoTokens) {
      const tokenData = {
        mint: account.account.data.parsed.info.mint,
        amount: account.account.data.parsed.info.tokenAmount.amount,  // This is raw token amount
        decimals: account.account.data.parsed.info.tokenAmount.decimals,
      };

      console.log('\n┌────────────── Token Information ──────────────┐');
      console.log(`│ Mint   : ${tokenData.mint}`);
      console.log(`│ Amount : ${formatNumber(Number(tokenData.amount))} (${tokenData.decimals} decimals)`);

      // Get metadata first
      try {
        const nft = await metaplex.nfts().findByMint({ mintAddress: new PublicKey(tokenData.mint) });
        if (nft) {
          console.log('│');
          console.log('│ 📋 Metadata');
          console.log(`│ Name        : ${nft.name}`);
          console.log(`│ Symbol      : ${nft.symbol}`);
          console.log(`│ URI         : ${nft.uri}`);
          if (nft.json?.image) {
            console.log(`│ Image       : ${nft.json.image}`);
          }
          if (nft.json?.description) {
            console.log(`│ Description : ${nft.json.description}`);
          }
        }
      } catch (metadataError) {
        console.log('│ ⚠️  No metadata available');
      }

      // Get price last
      const price = await getTokenPrice(tokenData.mint);
      console.log('│');
      console.log('│ 💰 Price Information');
      if (price) {
        const totalValue = (Number(tokenData.amount) / Math.pow(10, tokenData.decimals) * price);
        console.log(`│ Price       : ${formatNumber(price)} SOL`);
        console.log(`│ Total Value : ${formatNumber(totalValue)} SOL`);
      } else {
        console.log('│ Price: Not available for devnet token');
      }
      
      console.log('└────────────────────────────────────────────────┘');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
getWalletTokens();

// Install required package
// Run: npm install axios
import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import { WalletToken } from "../models/WalletToken";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// --- BUYPRICE CACHE ---
const buyPriceCache = new Map<string, number>();

export function startWalletSyncWatcher(connection: Connection, walletPublicKey: PublicKey) {
  const userPublicKey = walletPublicKey.toBase58();

  // Startup pe cache fill karo
  (async () => {
    //console.log(`[${new Date().toLocaleTimeString()}] Filling buyPriceCache from DB...`);
    const tokens = await WalletToken.find({ userPublicKey });
    for (const t of tokens) {
      buyPriceCache.set(`${userPublicKey}:${t.mint}`, t.buyPrice || 0);
    }
    //console.log(`[${new Date().toLocaleTimeString()}] buyPriceCache filled with ${tokens.length} tokens.`);
  })();

  async function sync() {
    const syncStart = Date.now();
    //console.log(`[${new Date().toLocaleTimeString()}] 🔄 Sync started`);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: TOKEN_PROGRAM_ID }
    );
    const walletMints = new Set<string>();
    const tokens = tokenAccounts.value;
    const batchSize = 5;
    //console.log(`[${new Date().toLocaleTimeString()}] Total tokens in wallet: ${tokens.length}`);
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      // console.log(
      //   `[${new Date().toLocaleTimeString()}] Processing batch ${
      //     i / batchSize + 1
      //   }: tokens ${i + 1} to ${i + batch.length}`
      // );
      await Promise.all(
        batch.map(async (account, idx) => {
          const mint = account.account.data.parsed.info.mint;
          const rawAmount = account.account.data.parsed.info.tokenAmount.amount;
          let decimals = account.account.data.parsed.info.tokenAmount.decimals ?? 6;
          
          // Convert raw amount to proper decimal format
          const amount = (parseInt(rawAmount) / Math.pow(10, decimals)).toString();
          
          let name = account.account.data.parsed.info.tokenAmount.name || "Unknown";
          let symbol = account.account.data.parsed.info.tokenAmount.symbol || "Unknown";

          // Agar name ya symbol "Unknown" hai to Metaplex se try karo
          if (name === "Unknown" || symbol === "Unknown") {
            try {
              //console.log(`[${new Date().toLocaleTimeString()}] [Batch ${i / batchSize + 1}] Fetching Metaplex meta for mint ${mint}`);
              const metaplex = new Metaplex(connection);
              const nft = await metaplex.nfts().findByMint({ mintAddress: new PublicKey(mint) });
              if (nft) {
                name = nft.name || name;
                symbol = nft.symbol || symbol;
                decimals = nft.mint?.decimals ?? decimals;
                // //console.log(
                //   `[${new Date().toLocaleTimeString()}] [Batch ${i / batchSize + 1}] Metaplex meta found for mint ${mint}: name=${name}, symbol=${symbol}, decimals=${decimals}`
                // );
              }
            } catch (e) {
              //console.error(`[${new Date().toLocaleTimeString()}] ❌ Error fetching Metaplex meta for mint ${mint}:`, e);
            }
          }

          walletMints.add(mint);
          const buyPrice = buyPriceCache.get(`${userPublicKey}:${mint}`) || 0;
          
          //console.log(`Token ${mint}: Raw amount=${rawAmount}, Decimals=${decimals}, Converted amount=${amount}, BuyPrice=${buyPrice}`);
          
          // Check if token already exists in DB with buy price
          const existingToken = await WalletToken.findOne({ mint, userPublicKey });
          const finalBuyPrice = existingToken?.buyPrice || buyPrice;
          
          await WalletToken.findOneAndUpdate(
            { mint, userPublicKey },
            { $set: { mint, userPublicKey, amount, buyPrice: finalBuyPrice, name, symbol, decimals } },
            { upsert: true, new: true }
          );
          buyPriceCache.set(`${userPublicKey}:${mint}`, finalBuyPrice);
          // console.log(
          //   `[${new Date().toLocaleTimeString()}] [Batch ${i / batchSize + 1}] Token synced: ${mint} (${name}, ${symbol}, amount=${amount})`
          // );
        })
      );
      // Batch ke baad 2-3 sec ka delay
      if (i + batchSize < tokens.length) {
        //console.log(`[${new Date().toLocaleTimeString()}] Batch ${i / batchSize + 1} done, waiting 2.5s before next batch...`);
        await new Promise((res) => setTimeout(res, 2500));
      }
    }
    // Instead, just log which tokens are missing from wallet
    const dbTokens = await WalletToken.find({ userPublicKey });
    const missingTokens = dbTokens.filter(t => !walletMints.has(t.mint));
    if (missingTokens.length > 0) {
      console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Tokens not in wallet but in DB: ${missingTokens.map(t => t.mint).join(', ')}`);
    }

    const syncEnd = Date.now();
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Wallet-DB sync done. Took ${(syncEnd - syncStart) / 1000}s`);
  }

  // Initial sync
  sync();
  // 5 min interval
  const interval = setInterval(sync, 5 * 60 * 1000);

  // Cleanup
  return () => clearInterval(interval);
}

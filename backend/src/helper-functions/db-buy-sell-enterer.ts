import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import { WalletToken } from "../models/WalletToken";
import { TokenPrice } from "../models/TokenPrice";
import { AutoSell } from "../models/autoSell";
import { getConnection } from "../utils/getProvider";
import { getCurrentPrice } from "./getCurrentPrice";

export async function addOrUpdateTokenFromBuy({
  mint,
  amount,
  buyPrice,
  userPublicKey,
}: {
  mint: string;
  amount: string;
  buyPrice: number;
  userPublicKey: string;
}) {
  const connection: Connection = getConnection();
  let name = "Unknown";
  let symbol = "Unknown";
  let decimals = 6;

  try {
    // Try SPL token meta from wallet
    const tokenAccountInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
    if (
      tokenAccountInfo.value &&
      typeof tokenAccountInfo.value.data === "object" &&
      "parsed" in tokenAccountInfo.value.data
    ) {
      const parsed = tokenAccountInfo.value.data.parsed;
      if (parsed.info) {
        name = parsed.info.name || name;
        symbol = parsed.info.symbol || symbol;
        decimals = parsed.info.decimals ?? decimals;
      }
    }
  } catch (e) {
    console.error(`❌ Error fetching SPL meta for mint ${mint}:`, e);
  }

  // If still unknown, try Metaplex
  if (name === "Unknown" || symbol === "Unknown") {
    try {
      const metaplex = new Metaplex(connection);
      const nft = await metaplex.nfts().findByMint({ mintAddress: new PublicKey(mint) });
      if (nft) {
        name = nft.name || name;
        symbol = nft.symbol || symbol;
        decimals = nft.mint?.decimals ?? decimals;
      }
    } catch (e) {
      console.error(`❌ Error fetching Metaplex meta for mint ${mint}:`, e);
    }
  }

  try {
    await WalletToken.findOneAndUpdate(
      { mint, userPublicKey },
      { $set: { mint, userPublicKey, amount, buyPrice, name, symbol, decimals } },
      { upsert: true, new: true }
    );
    console.log(`✅ WalletToken updated successfully for mint: ${mint}`);

    // Call separate function for TokenPrice update
    updateTokenPriceBuy(mint, buyPrice, userPublicKey);

  } catch (e) {
    console.error(`❌ Error updating WalletToken in DB for mint ${mint}:`, e);
  }
}

// Separate function for TokenPrice update
async function updateTokenPriceBuy(mint: string, buyPrice: number, userPublicKey: string) {
  try {
    const connection = getConnection();
    const currentPrice = await getCurrentPrice(connection, mint, new PublicKey(userPublicKey));
    
    //if (currentPrice > 0) {
      await TokenPrice.findOneAndUpdate(
        { mint, userPublicKey },
        { $set: { mint, userPublicKey, currentPrice, lastUpdated: new Date(), buyPrice } },
        { upsert: true }
      );

      await AutoSell.findOneAndUpdate(
        { mint, userPublicKey },
        { $set: { mint, userPublicKey, buyPrice } },
        { upsert: true }
      );
      
      console.log(` TokenPrice updated for ${mint}: ${currentPrice}`);
    //}
  } catch (error) {
    console.error(`❌ Error updating TokenPrice for mint ${mint}:`, error);
  }
}


async function updateTokenPriceSell(mint: string, userPublicKey: string) {
  try {
    const connection = getConnection();
    const currentPrice = await getCurrentPrice(connection, mint, new PublicKey(userPublicKey));
    
    //if (currentPrice > 0) {
      await TokenPrice.findOneAndUpdate(
        { mint, userPublicKey },
        { $set: { mint, userPublicKey, currentPrice, lastUpdated: new Date()} },
        { upsert: true }
      );
      console.log(` TokenPrice updated for ${mint}: ${currentPrice}`);
    //}
  } catch (error) {
    console.error(`❌ Error updating TokenPrice for mint ${mint}:`, error);
  }
}

export async function updateOrRemoveTokenAfterSell({
  mint,
  userPublicKey,
  remainingAmount,
}: {
  mint: string;
  userPublicKey: string;
  remainingAmount: string;
}) {
  //const connection: Connection = getConnection();

  if (parseFloat(remainingAmount) <= 0) {
    await WalletToken.deleteOne({ mint, userPublicKey });
    console.log(`🗑️ Token ${mint} removed from DB (sold 100%)`);
  } else {
    await WalletToken.findOneAndUpdate(
      { mint, userPublicKey },
      { $set: { amount: remainingAmount } },
    );
    console.log(`✏️ Token ${mint} amount updated to ${remainingAmount}`);
    updateTokenPriceSell(mint, userPublicKey);
  }

  // Fetch current price and update TokenPrice model after sell

}
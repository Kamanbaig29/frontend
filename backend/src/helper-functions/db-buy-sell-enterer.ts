import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import { MemeHomeToken } from "../models/MemeHomeToken";
import { UserToken } from "../models/userToken";
//import { TokenPrice } from "../models/TokenPrice";
//import { AutoSell } from "../models/autoSell";
import { getConnection } from "../utils/getProvider";
import { getCurrentPrice } from "./getCurrentPrice";

export async function addOrUpdateTokenFromBuy({
  mint,
  amount,
  buyPrice,
  userPublicKey,
  signature,
  userID,
}: {
  mint: string;
  amount: string;
  buyPrice: number;
  userPublicKey: string;
  signature: string;
  userID: string;
}) {
  const connection: Connection = getConnection();
  let name = "Unknown";
  let symbol = "Unknown";
  let decimals = 6;
  let imageUrl = undefined;
  let metadataUri = undefined;
  let creationTimestamp = Date.now();
  let currentPrice = undefined;
  let platform = 'memehome';
  let creator = undefined;

  // Try to get from MemeHomeToken model first
  const memeToken = await MemeHomeToken.findOne({ mint });
  if (memeToken) {
    name = memeToken.name;
    symbol = memeToken.symbol;
    decimals = memeToken.decimals;
    imageUrl = memeToken.imageUrl;
    metadataUri = memeToken.metadataUri;
    creationTimestamp = memeToken.creationTimestamp;
    //currentPrice = memeToken.currentPrice;
    platform = 'memehome';
    creator = memeToken.creator;
  } else {
    // Try SPL token meta from wallet
    try {
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
          imageUrl = nft.json?.image;
          metadataUri = nft.uri;
        }
      } catch (e) {
        console.error(`❌ Error fetching Metaplex meta for mint ${mint}:`, e);
      }
    }
  }

  // Get balance as number
  // Save as raw string or integer, no parseFloat
  const balance = amount; // amount should be raw string (e.g. "17590167065574")


  currentPrice =  await getCurrentPrice(connection, mint, new PublicKey(userPublicKey));

  try {
    await UserToken.findOneAndUpdate(
      { mint, walletAddress: userPublicKey },
      {
        $set: {
          userId: userID, // If you have a separate userId, update this accordingly
          walletAddress: userPublicKey,
          mint: mint,
          name: name,
          symbol: symbol,
          imageUrl: imageUrl,
          metadataUri: metadataUri,
          decimals: decimals,
          creator: creator,
          creationTimestamp: creationTimestamp,
          currentPrice: currentPrice,
          lastUpdated: Date.now(),
          platform: platform,
          buyAmount: buyPrice,
          lastBuySignature: signature,
          balance: balance,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`✅ UserToken updated successfully for mint: ${mint}`);

    // Call separate function for TokenPrice update
    //updateTokenPriceBuy(mint, buyPrice, userPublicKey);
  } catch (e) {
    console.error(`❌ Error updating UserToken in DB for mint ${mint}:`, e);
  }
}



export async function updateOrRemoveTokenAfterSell({
  mint,
  userPublicKey,
  remainingAmount,
  signature,
}: {
  mint: string;
  userPublicKey: string;
  remainingAmount: string;
  signature?: string;
}) {
  // Treat very small balances as zero (floating point safety)
  const remaining = parseFloat(remainingAmount);
  //if (remaining <= 0 || Math.abs(remaining) < 1e-6) {
    // Remove UserToken if balance is zero
    //await UserToken.deleteOne({ mint, walletAddress: userPublicKey });
    //await TokenPrice.deleteOne({ mint, userPublicKey });
    //await AutoSell.deleteOne({ mint, userPublicKey });
    //console.log(`🗑️ Token ${mint} removed from DB (sold 100%)`);
  //} else {
    // Update UserToken balance
    await UserToken.findOneAndUpdate(
      { mint, walletAddress: userPublicKey },
      { $set: { balance: remaining, lastSellSignature: signature,} }
    );
    console.log(`✏️ Token ${mint} amount updated to ${remaining}`);
    //updateTokenPriceSell(mint, userPublicKey);
  //}
}
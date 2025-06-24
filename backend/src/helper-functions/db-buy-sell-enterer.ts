import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import { WalletToken } from "../models/WalletToken";
import { getConnection } from "../utils/getProvider";

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
  } catch (e) {
    console.error(`❌ Error updating WalletToken in DB for mint ${mint}:`, e);
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
  if (parseFloat(remainingAmount) <= 0) {
    await WalletToken.deleteOne({ mint, userPublicKey });
    console.log(`🗑️ Token ${mint} removed from DB (sold 100%)`);
  } else {
    await WalletToken.findOneAndUpdate(
      { mint, userPublicKey },
      { $set: { amount: remainingAmount } },
    );
    console.log(`✏️ Token ${mint} amount updated to ${remainingAmount}`);
  }
}
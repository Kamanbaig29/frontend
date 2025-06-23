import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import { WalletToken } from "../models/WalletToken";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AutoSell } from "../models/autoSell";
import { TokenPrice } from "../models/TokenPrice";
import { getCurrentPrice } from "./getCurrentPrice";

const POLL_INTERVAL_MS = 10000; // 30 seconds (recommended)

// Function to check and remove only duplicates for current wallet
async function checkForDuplicates(currentWallet: string) {
    const duplicates = await WalletToken.aggregate([
        {
            $match: {
                userPublicKey: currentWallet
            }
        },
        {
            $group: {
                _id: "$mint",
                count: { $sum: 1 },
                docs: { $push: "$_id" }
            }
        },
        {
            $match: {
                count: { $gt: 1 }
            }
        }
    ]);

    if (duplicates.length > 0) {
        console.log("🔍 Found duplicate entries for current wallet:");
        for (const dup of duplicates) {
            console.log(`Mint: ${dup._id}, Count: ${dup.count}`);
            const [keep, ...remove] = dup.docs;
            await WalletToken.deleteMany({ 
                _id: { $in: remove },
                userPublicKey: currentWallet
            });
            console.log(`✅ Removed ${remove.length} duplicate entries for ${dup._id}`);
        }
    }
}

export async function watchWalletTokens(
    connection: Connection,
    walletPublicKey: PublicKey
) {
    const metaplex = new Metaplex(connection);
    let isPolling = true;

    async function poll() {
        if (!isPolling) return;

        const currentWallet = walletPublicKey.toBase58();
        console.log(`🔄 Polling wallet tokens for: ${currentWallet}`);

        try {
            await checkForDuplicates(currentWallet);

            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                walletPublicKey,
                { programId: TOKEN_PROGRAM_ID }
            );

            const dbCount = await WalletToken.countDocuments({ userPublicKey: currentWallet });
            console.log(`📊 Database entries for current wallet: ${dbCount}`);
            console.log(`📦 Wallet tokens: ${tokenAccounts.value.length}`);

            for (const account of tokenAccounts.value) {
                const tokenMint = account.account.data.parsed.info.mint;
                const tokenAmount = account.account.data.parsed.info.tokenAmount.amount;
                const decimals = account.account.data.parsed.info.tokenAmount.decimals;
                const humanReadableAmount = (parseInt(tokenAmount) / Math.pow(10, decimals)).toString();

                try {
                    const existingToken = await WalletToken.findOne({ 
                        mint: tokenMint,
                        userPublicKey: currentWallet
                    });

                    // === Only update if new token or amount changed ===
                    if (!existingToken) {
                        console.log(`📡 Fetching metadata for new token ${tokenMint}...`);

                        const nft = await metaplex
                            .nfts()
                            .findByMint({ mintAddress: new PublicKey(tokenMint) });

                        await WalletToken.create({
                            mint: tokenMint,
                            amount: humanReadableAmount,
                            name: nft?.name || "Unknown",
                            symbol: nft?.symbol || "Unknown",
                            decimals: decimals,
                            description: nft?.json?.description || "",
                            userPublicKey: currentWallet
                        });

                        console.log(`🆕 Added new token ${tokenMint} with amount ${humanReadableAmount}`);

                        // === Only for new token: update price ===
                        const latestPrice = await getCurrentPrice(connection, tokenMint);
                        await TokenPrice.findOneAndUpdate(
                            { mint: tokenMint },
                            { $set: { currentPrice: latestPrice, lastUpdated: new Date() } },
                            { upsert: true }
                        );
                    } else if (existingToken.amount !== humanReadableAmount) {
                        console.log(
                            `📝 Amount change detected for ${tokenMint}: ${existingToken.amount} → ${humanReadableAmount}`
                        );

                        await WalletToken.updateOne(
                            { 
                                mint: tokenMint,
                                userPublicKey: currentWallet
                            },
                            { amount: humanReadableAmount }
                        );

                        console.log(`♻️ Updated amount for token ${tokenMint}`);

                        // === Only for changed token: update price ===
                        const latestPrice = await getCurrentPrice(connection, tokenMint);
                        await TokenPrice.findOneAndUpdate(
                            { mint: tokenMint },
                            { $set: { currentPrice: latestPrice, lastUpdated: new Date() } },
                            { upsert: true }
                        );
                    }

                    // Metadata update (name, symbol) as before
                    if (existingToken && existingToken.name === "Unknown") {
                        console.log(`🔄 Updating metadata for token with unknown name: ${tokenMint}`);

                        const nft = await metaplex
                            .nfts()
                            .findByMint({ mintAddress: new PublicKey(tokenMint) });

                        await WalletToken.updateOne(
                            { 
                                mint: tokenMint,
                                userPublicKey: currentWallet
                            },
                            {
                                $set: {
                                    name: nft?.name || "Unknown",
                                    symbol: nft?.symbol || "Unknown",
                                    decimals: decimals,
                                    description: nft?.json?.description || ""
                                },
                            }
                        );

                        console.log(`✅ Metadata updated for token ${tokenMint}`);
                    }
                } catch (err) {
                    console.error(`❌ Error processing token ${tokenMint}:`, err);
                }
            }

            const walletTokens = await WalletToken.find({ userPublicKey: currentWallet });
            const autoSellTokens = await AutoSell.find({ userPublicKey: currentWallet });

            const autoSellMints = new Set(autoSellTokens.map(t => t.mint));

            for (const token of walletTokens) {
                if (!autoSellMints.has(token.mint)) {
                    await AutoSell.create({
                        mint: token.mint,
                        userPublicKey: token.userPublicKey,
                        buyPrice: token.buyPrice,
                        // All other fields will use schema defaults
                    });
                    console.log(`AutoSell entry created for ${token.mint}`);
                }
            }
        } catch (err) {
            console.error("❌ Error fetching token accounts:", err);
        }

        if (isPolling) {
            setTimeout(poll, POLL_INTERVAL_MS);
        }
    }

    const cleanup = () => {
        console.log('🧹 Cleaning up wallet token watcher...');
        isPolling = false;
    };

    poll();
    return cleanup;
}

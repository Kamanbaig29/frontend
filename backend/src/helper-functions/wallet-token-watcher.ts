import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import { WalletToken } from "../models/WalletToken";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const POLL_INTERVAL_MS = 10000; // 10 seconds

// Function to check and remove only duplicates
async function checkForDuplicates() {
    const duplicates = await WalletToken.aggregate([
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
        console.log("🔍 Found duplicate entries:");
        for (const dup of duplicates) {
            console.log(`Mint: ${dup._id}, Count: ${dup.count}`);
            // Keep the most recent entry, delete others
            const [keep, ...remove] = dup.docs;
            await WalletToken.deleteMany({ _id: { $in: remove } });
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

        console.log(`🔄 Polling wallet tokens for: ${walletPublicKey.toBase58()}`);

        try {
            // First check for duplicates
            await checkForDuplicates();

            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                walletPublicKey,
                { programId: TOKEN_PROGRAM_ID }
            );

            // Log counts for comparison
            const dbCount = await WalletToken.countDocuments();
            console.log(`📊 Database entries: ${dbCount}`);
            console.log(`📦 Wallet tokens: ${tokenAccounts.value.length}`);

            for (const account of tokenAccounts.value) {
                const tokenMint = account.account.data.parsed.info.mint;
                const tokenAmount = account.account.data.parsed.info.tokenAmount.amount;
                const decimals = account.account.data.parsed.info.tokenAmount.decimals;

                // Convert token amount to human readable format
                const humanReadableAmount = (parseInt(tokenAmount) / Math.pow(10, decimals)).toString();

                try {
                    const existingToken = await WalletToken.findOne({ mint: tokenMint });

                    if (!existingToken) {
                        console.log(`📡 Fetching metadata for new token ${tokenMint}...`);

                        const nft = await metaplex
                            .nfts()
                            .findByMint({ mintAddress: new PublicKey(tokenMint) });

                        await WalletToken.create({
                            mint: tokenMint,
                            amount: humanReadableAmount, // Store human readable amount
                            name: nft?.name || "Unknown",
                            symbol: nft?.symbol || "Unknown",
                            decimals: decimals,
                            description: nft?.json?.description || "",
                        });

                        console.log(`🆕 Added new token ${tokenMint} with amount ${humanReadableAmount}`);
                    } else {
                        if (existingToken.amount !== humanReadableAmount) {
                            console.log(
                                `📝 Amount change detected for ${tokenMint}: ${existingToken.amount} → ${humanReadableAmount}`
                            );

                            await WalletToken.updateOne(
                                { mint: tokenMint },
                                { amount: humanReadableAmount } // Update with human readable amount
                            );

                            console.log(`♻️ Updated amount for token ${tokenMint}`);
                        }

                        if (existingToken.name === "Unknown") {
                            console.log(`🔄 Updating metadata for token with unknown name: ${tokenMint}`);

                            const nft = await metaplex
                                .nfts()
                                .findByMint({ mintAddress: new PublicKey(tokenMint) });

                            await WalletToken.updateOne(
                                { mint: tokenMint },
                                {
                                    $set: {
                                        name: nft?.name || "Unknown",
                                        symbol: nft?.symbol || "Unknown",
                                        decimals: decimals,
                                        description: nft?.json?.description || "",
                                    },
                                }
                            );

                            console.log(`✅ Metadata updated for token ${tokenMint}`);
                        }
                    }
                } catch (err) {
                    if (err instanceof Error) {
                        console.error(`❌ Error processing token ${tokenMint}:`, err.message);
                    } else {
                        console.error(`❌ Unknown error processing token ${tokenMint}:`, err);
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error) {
                console.error("❌ Error fetching token accounts:", err.message);
            } else {
                console.error("❌ Unknown error fetching token accounts:", err);
            }
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

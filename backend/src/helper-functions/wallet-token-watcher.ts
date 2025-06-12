import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import { WalletToken } from "../models/WalletToken";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const POLL_INTERVAL_MS = 5000; // 10 seconds

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
            // Check for duplicates for current wallet
            await checkForDuplicates(currentWallet);

            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                walletPublicKey,
                { programId: TOKEN_PROGRAM_ID }
            );

            // Log counts for comparison
            const dbCount = await WalletToken.countDocuments({ userPublicKey: currentWallet });
            console.log(`📊 Database entries for current wallet: ${dbCount}`);
            console.log(`📦 Wallet tokens: ${tokenAccounts.value.length}`);

            for (const account of tokenAccounts.value) {
                const tokenMint = account.account.data.parsed.info.mint;
                const tokenAmount = account.account.data.parsed.info.tokenAmount.amount;
                const decimals = account.account.data.parsed.info.tokenAmount.decimals;

                const humanReadableAmount = (parseInt(tokenAmount) / Math.pow(10, decimals)).toString();

                try {
                    // Only look for tokens with current wallet
                    const existingToken = await WalletToken.findOne({ 
                        mint: tokenMint,
                        userPublicKey: currentWallet
                    });

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
                    } else {
                        if (existingToken.amount !== humanReadableAmount) {
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
                        }

                        if (existingToken.name === "Unknown") {
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

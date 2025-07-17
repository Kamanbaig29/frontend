import 'dotenv/config';
import { getBuyersCount } from './helper-functions/getBuyersCount';

async function main() {
  // Default mint address if none provided
  const defaultMint = 'HJjy7SMJmht6efiyWuuDTHUExJHyBXJqkKBPiZT6TP3a';
  const mint = process.argv[2] || defaultMint;
  if (!mint) {
    console.error('Usage: ts-node src/test-buyCount.ts <MINT_ADDRESS>');
    process.exit(1);
  }
  try {
    const count = await getBuyersCount(mint);
    console.log(`Buyers count for mint ${mint}:`, count);
  } catch (e) {
    console.error('Error:', e);
  }
}

main();

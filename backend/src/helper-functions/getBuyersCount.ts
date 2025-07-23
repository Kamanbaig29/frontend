import { Connection, PublicKey } from '@solana/web3.js';

// amazonq-ignore-next-line
export async function getBuyersCount(mintAddress: string): Promise<number> {
  // amazonq-ignore-next-line
  const connection = new Connection(process.env.RPC_ENDPOINT!);
  const mint = new PublicKey(mintAddress);
  const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

  const accounts = await connection.getProgramAccounts(
    TOKEN_PROGRAM_ID,
    {
      filters: [
        // amazonq-ignore-next-line
        { dataSize: 165 }, // SPL Token account size
        { memcmp: { offset: 0, bytes: mint.toBase58() } }
      ]
    }
  );

  const buyers = accounts.filter(acc => {
    // amount is at offset 64, 8 bytes (u64 LE)
    const amountData = acc.account.data.slice(64, 72);
    const amount = Number(amountData.readBigUInt64LE(0));
    return amount > 0;
  });

  return buyers.length;
} 
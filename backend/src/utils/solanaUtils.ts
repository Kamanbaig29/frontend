import { Connection, PublicKey } from '@solana/web3.js';

// amazonq-ignore-next-line
const connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');

// amazonq-ignore-next-line
export const getWalletBalance = async (publicKeyString: string) => {
  try {
    const publicKey = new PublicKey(publicKeyString);
    const balance = await connection.getBalance(publicKey);
    // amazonq-ignore-next-line
    return (balance / 1000000000).toString();
  } catch (error) {
    // amazonq-ignore-next-line
    console.error('Error fetching balance:', error);
    return '0';
  }
};

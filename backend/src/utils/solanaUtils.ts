import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');

export const getWalletBalance = async (publicKeyString: string) => {
  try {
    const publicKey = new PublicKey(publicKeyString);
    const balance = await connection.getBalance(publicKey);
    return (balance / 1000000000).toString();
  } catch (error) {
    console.error('Error fetching balance:', error);
    return '0';
  }
};

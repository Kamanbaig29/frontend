import { Keypair } from '@solana/web3.js';
import crypto from 'crypto';

export const generateBotWallet = () => {
  const keypair = Keypair.generate();
  
  // Encrypt the secret key before storing
  const secretKeyString = JSON.stringify(Array.from(keypair.secretKey));
  
  // Use modern crypto methods
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.WALLET_ENCRYPTION_KEY || 'default-key', 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encryptedSecretKey = cipher.update(secretKeyString, 'utf8', 'hex');
  encryptedSecretKey += cipher.final('hex');
  
  // Store IV with encrypted data
  const encryptedData = iv.toString('hex') + ':' + encryptedSecretKey;
  
  return {
    publicKey: keypair.publicKey.toString(),
    encryptedSecretKey: encryptedData
  };
};

export const decryptWalletSecretKey = (encryptedSecretKey: string) => {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.WALLET_ENCRYPTION_KEY || 'default-key', 'salt', 32);
  
  // Split IV and encrypted data
  const [ivHex, encryptedData] = encryptedSecretKey.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
};

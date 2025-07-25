import express, { Request, Response, RequestHandler } from 'express';
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getUserKeypairById } from '../utils/userWallet';

const router = express.Router();

const withdrawHandler: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { destinationAddress, amount, userId } = req.body;
    
    console.log('=== WITHDRAW REQUEST ===');
    console.log('destinationAddress:', destinationAddress);
    console.log('amount:', amount, 'type:', typeof amount);
    console.log('userId:', userId);
    console.log('Full req.body:', req.body);

    if (!destinationAddress || !amount || !userId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Validate destination address
    try {
      new PublicKey(destinationAddress);
    } catch (error) {
      res.status(400).json({ error: 'Invalid destination address' });
      return;
    }

    // Get user wallet
    const userWallet = await getUserKeypairById(userId);

    // Connect to Solana
    const connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');
    
    // Convert amount to lamports
    const lamports = Math.floor(parseFloat(amount) * 1e9);
    
    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: userWallet.publicKey,
        toPubkey: new PublicKey(destinationAddress),
        lamports: lamports,
      })
    );

    // Get initial balance
    const initialBalance = await connection.getBalance(userWallet.publicKey);
    
    // Send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [userWallet]
    );

    // Wait for balance to change with polling
    let updatedBalance = initialBalance;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (updatedBalance === initialBalance && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      updatedBalance = await connection.getBalance(userWallet.publicKey);
      attempts++;
      console.log(`Balance check attempt ${attempts}: ${updatedBalance / 1e9} SOL`);
    }
    
    const balanceInSol = updatedBalance / 1e9;
    


    res.json({
      success: true,
      signature,
      amount: parseFloat(amount),
      destinationAddress,
      newBalance: balanceInSol
    });

  } catch (error: any) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: error.message || 'Withdrawal failed' });
  }
};

router.post('/withdraw', withdrawHandler);

export default router;
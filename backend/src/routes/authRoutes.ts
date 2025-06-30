import { Router } from 'express';
import { signup, verifyOtp, login, phantomLogin, logout } from '../controllers/authController';
import { authenticateJWT } from '../middleware/authMiddleware';
import  User  from '../models/user_auth';
import { getWalletBalance } from '../utils/solanaUtils';

const router = Router();

// Route for user signup
// POST /api/auth/signup
router.post('/signup', signup);

// Route for verifying OTP
// POST /api/auth/verify-otp
router.post('/verify-otp', verifyOtp);

// Route for user login
// POST /api/auth/login
router.post('/login', login);

// Route for Phantom login
// POST /api/auth/phantom-login
router.post('/phantom-login', phantomLogin);

// Logout route
router.post('/logout', authenticateJWT, logout);

router.get('/protected', authenticateJWT, (req, res) => {
  res.json({ message: 'You are authenticated!', user: (req as any).user });
});

// Wallet info endpoint
router.get('/wallet-info', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById((req as any).user.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    
    if (!user.botWalletPublicKey) {
      res.status(404).json({ message: 'Wallet not found' });
      return;
    }
    
    // Get wallet balance
    const balance = await getWalletBalance(user.botWalletPublicKey);
    
    res.json({
      walletAddress: user.botWalletPublicKey,
      balance: balance
    });
  } catch (error) {
    console.error('Error fetching wallet info:', error);
    res.status(500).json({ message: 'Error fetching wallet info' });
  }
});

export default router;

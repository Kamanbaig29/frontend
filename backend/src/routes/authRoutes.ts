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

// amazonq-ignore-next-line
router.get('/protected', authenticateJWT, (req, res) => {
  res.json({ message: 'You are authenticated!', user: (req as any).user });
});

// User profile info endpoint
router.get('/profile-info', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById((req as any).user.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    
    // Determine display name based on login method
    let displayName = '';
    if (user.name) {
      // User logged in with email and has a name
      displayName = user.name;
    } else if (user.botWalletPublicKey) {
      // User logged in with wallet, show shortened address
      displayName = `${user.botWalletPublicKey.slice(0, 6)}...${user.botWalletPublicKey.slice(-4)}`;
    } else {
      // Fallback
      displayName = 'Unknown User';
    }
    
    // Format user ID as 123...908
    const userIdString = (user._id as any).toString();
    const formattedUserId = `${userIdString.slice(0, 3)}...${userIdString.slice(-3)}`;
    
    res.json({
      userId: (user._id as any).toString(),
      formattedUserId: formattedUserId,
      displayName: displayName,
      fullName: user.name || null,
      solanaAddress: user.solanaAddress || null,
      botWalletAddress: user.botWalletPublicKey || null,
      email: user.email || null,
      isWalletUser: !!user.solanaAddress && !user.email,
      isEmailUser: !!user.email,
      hasBotWallet: !!user.botWalletPublicKey
    });
  } catch (error) {
    console.error('Error fetching profile info:', error);
    res.status(500).json({ message: 'Error fetching profile info' });
  }
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
  // amazonq-ignore-next-line
  } catch (error) {
    console.error('Error fetching wallet info:', error);
    res.status(500).json({ message: 'Error fetching wallet info' });
  }
});

export default router;

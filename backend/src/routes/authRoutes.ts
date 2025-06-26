import { Router } from 'express';
import { signup, verifyOtp, login, phantomLogin } from '../controllers/authController';
import { authenticateJWT } from '../middleware/authMiddleware';

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

router.get('/protected', authenticateJWT, (req, res) => {
  res.json({ message: 'You are authenticated!', user: (req as any).user });
});

export default router;

import { Router } from 'express';
import { authenticateJWT } from '../middleware/authMiddleware';
//import { startUserServices, stopUserServices } from '../servcies/userBotServices';
import User from '../models/user_auth';

// Add this declaration to extend the Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

const router = Router();

router.post('/start-services', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    //console.log('POST /api/bot/start-services called');
    //console.log('user in /start-services:', req.user);

    const user = await User.findById(userId);
    if (!user || !user.botWalletPublicKey) {
      res.status(404).json({ message: 'User wallet not found' });
      return;
    }

    //await startUserServices(userId, user.botWalletPublicKey);
    
    res.status(200).json({ message: 'Services started' });
  } catch (error) {
    //console.error('Error starting services:', error);
    res.status(500).json({ message: 'Failed to start services', error: (error as Error).message });
  }
});

router.post('/stop-services', authenticateJWT, async (req, res) => {
    //console.log('user in /stop-services:', (req as any).user);
  try {
    const userId = (req as any).user.id;
    //await stopUserServices(userId);
    res.json({ message: 'Services stopped' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

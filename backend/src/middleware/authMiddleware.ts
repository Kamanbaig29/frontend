import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      (req as any).user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ message: 'Invalid or expired token.' });
    }
  } else {
    res.status(401).json({ message: 'No token provided.' });
  }
};

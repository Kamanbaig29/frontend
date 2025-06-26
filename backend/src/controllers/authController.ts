import { Request, Response, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user_auth'; // Importing our User model
import sendEmail from '../utils/sendEmail'; // Importing our email utility
import { PublicKey } from '@solana/web3.js';
import * as ed25519 from '@noble/ed25519';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// --- 1. SIGNUP CONTROLLER ---
export const signup: RequestHandler = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: 'Please provide name, email, and password.' });
    return;
  }

  try {
    let user = await User.findOne({ email });
    
    // If user exists but is not verified, we'll just send a new OTP
    if (user && !user.isVerified) {
      const otp = crypto.randomInt(100000, 999999).toString();
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10-minute expiry
      await user.save();
      
      await sendEmail(email, 'Verify Your Email Again', `Your new OTP is: <strong>${otp}</strong>`);
      res.status(200).json({ message: 'User already exists but is not verified. A new OTP has been sent.' });
      return;
    }

    if (user && user.isVerified) {
      res.status(409).json({ message: 'A verified user with this email already exists.' });
      return;
    }

    // If user does not exist, create a new one
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const otp = crypto.randomInt(100000, 999999).toString();

    user = new User({
      name,
      email,
      passwordHash,
      otp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
    });

    await user.save();
    
    await sendEmail(email, 'Welcome! Verify Your Account', `Your OTP to complete signup is: <strong>${otp}</strong>`);

    res.status(201).json({
      message: 'User registered successfully. Please check your email for the OTP.',
    });

  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};


// --- 2. VERIFY OTP CONTROLLER ---
export const verifyOtp: RequestHandler = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400).json({ message: 'Email and OTP are required.' });
    return;
  }

  try {
    const user = await User.findOne({ email }).select('+otp +otpExpires');

    if (!user || user.otp !== otp || user.otpExpires! < new Date()) {
      res.status(400).json({ message: 'Invalid or expired OTP.' });
      return;
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    
    res.status(200).json({ message: 'Account verified successfully. You can now log in.' });

  } catch (error) {
    console.error('OTP Verification Error:', error);
    res.status(500).json({ message: 'Server error during OTP verification.' });
  }
};


// --- 3. LOGIN CONTROLLER ---
export const login: RequestHandler = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required.' });
        return;
    }

    try {
        const user = await User.findOne({ email }).select('+passwordHash');

        if (!user || !user.passwordHash) {
            res.status(401).json({ message: 'Invalid credentials.' });
            return;
        }

        if (!user.isVerified) {
            res.status(403).json({ message: 'Account is not verified. Please check your email.' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials.' });
            return;
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
        
        const userResponse = user.toObject();
        delete userResponse.passwordHash;

        res.status(200).json({
            message: 'Login successful.',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

export const phantomLogin = async (req: Request, res: Response) => {
  const { publicKey, message, signature } = req.body;

  if (!publicKey || !message || !signature) {
    res.status(400).json({ message: 'Missing parameters.' });
    return;
  }

  try {
    const pubKey = new PublicKey(publicKey);
    const msgUint8 = new TextEncoder().encode(message);
    const sigUint8 = Uint8Array.from(signature);

    // Use noble-ed25519 to verify
    const isValid = await ed25519.verify(
      sigUint8,
      msgUint8,
      pubKey.toBytes()
    );

    if (!isValid) {
      res.status(401).json({ message: 'Invalid signature.' });
      return;
    }

    // Find or create user
    let user = await User.findOne({ solanaAddress: publicKey });
    if (!user) {
      user = await User.create({
        solanaAddress: publicKey,
        isVerified: true,
      });
    }

    // Create JWT
    const token = jwt.sign({ id: user.id, solanaAddress: publicKey }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

    res.status(200).json({
      message: 'Phantom login successful.',
      token,
      user: { solanaAddress: publicKey }
    });
  } catch (error) {
    console.error('Phantom login error:', error);
    res.status(500).json({ message: 'Server error during Phantom login.' });
  }
};

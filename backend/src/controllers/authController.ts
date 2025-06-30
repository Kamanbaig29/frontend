import { Request, Response, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user_auth'; // Importing our User model
import sendEmail from '../utils/sendEmail'; // Importing our email utility
import { PublicKey } from '@solana/web3.js';
import * as ed25519 from '@noble/ed25519';
import { generateBotWallet } from '../utils/walletUtils';
import bs58 from 'bs58';

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

    // Generate wallet for new user
    const { publicKey, encryptedSecretKey } = generateBotWallet();

    user = new User({
      name,
      email,
      passwordHash,
      otp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
      botWalletPublicKey: publicKey,
      botWalletSecretKeyEncrypted: encryptedSecretKey
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
  try {
    const { email, password } = req.body;

    // Find user by email and explicitly select passwordHash
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        walletAddress: user.botWalletPublicKey
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
};

export const phantomLogin: RequestHandler = async (req, res) => {
  try {
    const { publicKey, signature, message } = req.body;

    // Defensive check
    if (typeof publicKey !== "string" || typeof signature !== "string" || typeof message !== "string") {
      res.status(400).json({ message: "Invalid payload for Phantom login" });
      return;
    }

    // Debug log
    console.log("Phantom login payload:", { publicKey, signature, message });

    // Verify signature
    const messageBytes = new TextEncoder().encode(message);
    const publicKeyBytes = bs58.decode(publicKey);
    const signatureBytes = bs58.decode(signature);

    const isValid = await ed25519.verify(signatureBytes, messageBytes, publicKeyBytes);
    if (!isValid) {
      res.status(401).json({ message: 'Invalid signature' });
      return;
    }

    // Find or create user - use solanaAddress field from model
    let user = await User.findOne({ solanaAddress: publicKey });
    
    if (!user) {
      // Create new user with Phantom wallet
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);
      
      // Generate wallet for new user
      const { publicKey: newPublicKey, encryptedSecretKey } = generateBotWallet();

      user = new User({
        solanaAddress: publicKey,
        email: `${publicKey.slice(0, 8)}...@phantom.com`,
        passwordHash: passwordHash,
        isVerified: true,
        botWalletPublicKey: newPublicKey,
        botWalletSecretKeyEncrypted: encryptedSecretKey
      });
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Phantom login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        walletAddress: user.botWalletPublicKey
      }
    });
  } catch (error) {
    console.error('Phantom login error:', error);
    res.status(500).json({ message: 'Phantom login failed' });
  }
};

export const logout: RequestHandler = async (req, res) => {
  try {
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
};

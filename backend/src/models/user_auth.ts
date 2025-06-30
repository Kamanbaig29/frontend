import mongoose, { Document, Schema } from 'mongoose';

// Interface to define the User document structure
export interface IUser extends Document {
  email?: string;
  name?: string;
  passwordHash?: string;
  googleId?: string;
  solanaAddress?: string;

  isVerified: boolean;
  otp?: string;
  otpExpires?: Date;

  botWalletPublicKey?: string; // Becomes required only after verification
  botWalletSecretKeyEncrypted?: string; // Becomes required only after verification

  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  // --- Universal Fields ---
  email: {
    type: String,
    unique: true,
    // `sparse: true` allows multiple documents to have a null/missing `email` field.
    // This is crucial for users who sign up only with a Phantom wallet and don't provide an email.
    sparse: true,
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    trim: true,
  },

  // --- Authentication Method Specific Fields ---
  passwordHash: {
    type: String,
    // `select: false` ensures this field is NOT returned in queries by default.
    // A crucial security measure to avoid accidentally exposing password hashes.
    select: false,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null/missing values
  },
  solanaAddress: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null/missing values
  },
  
  // --- Verification Fields ---
  isVerified: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: String,
    select: false,
  },
  otpExpires: {
    type: Date,
    select: false,
  },

  // --- Bot Wallet For The User (Added after verification) ---
  botWalletPublicKey: {
    type: String,
    unique: true,
    sparse: true, // Allows null values
  },
  botWalletSecretKeyEncrypted: {
    type: String,
    select: false, // Hide from default queries
  },

  // --- Timestamps ---
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the User model
const User = mongoose.model<IUser>('User', UserSchema);
export default User;

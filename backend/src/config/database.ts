import mongoose from 'mongoose';
import { AutoTokenBuy } from '../models/AutoTokenBuy';
import { TokenStats } from '../models/TokenStats';
import { WalletToken } from '../models/WalletToken';

export async function connectDatabase() {
  try {
    const uri = 'mongodb://127.0.0.1:27017/token-sniper';
    await mongoose.connect(uri);
    
    // Check if connection is established
    if (!mongoose.connection.db) {
      throw new Error('Database connection not established');
    }
    
    console.log('📦 Connected to MongoDB');
    console.log(`🔗 Connection URI: ${uri}`);

    // Test collection creation
    await Promise.all([
      AutoTokenBuy.createCollection(),
      TokenStats.createCollection(),
      WalletToken.createCollection()
    ]);

    // Get database instance with type checking
    const db = mongoose.connection.db;
    
    // Log collection info
    const collections = await db.collections();
    console.log('\n📊 Available collections:');
    for (let collection of collections) {
      const count = await collection.countDocuments();
      console.log(`- ${collection.collectionName}: ${count} documents`);
    }

    // Add connection error handler
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    return false;
  }
}
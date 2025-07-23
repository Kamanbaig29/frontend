import mongoose from 'mongoose';
//import { AutoTokenBuy } from '../models/AutoTokenBuy';
//import { TokenStats } from '../models/TokenStats';
//import { WalletToken } from '../models/WalletToken';
//import { AutoSell } from '../models/autoSell';
import { UserToken } from '../models/userToken'; // Import the new model
import dotenv from 'dotenv';

dotenv.config();

export async function connectDatabase() {
  try {
    // MongoDB Atlas connection string
    const uri = process.env.MONGODB_URI || 'mongodb+srv://kamranbaig2905:LKASxIIjGq8wrXXX@cluster0.cwndoj3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    
    await mongoose.connect(uri);
    
    // Check if connection is established
    if (!mongoose.connection.db) {
      throw new Error('Database connection not established');
    }
    
    console.log('📦 Connected to MongoDB Atlas');
    // amazonq-ignore-next-line
    // amazonq-ignore-next-line
    // amazonq-ignore-next-line
    console.log(`🔗 Connection URI: ${uri}`);

    // Test collection creation
    await Promise.all([
      //AutoTokenBuy.createCollection(),
      //TokenStats.createCollection(),
      //WalletToken.createCollection(),
      //AutoSell.createCollection(),
      UserToken.createCollection() // Ensure UserToken collection is created
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
      // amazonq-ignore-next-line
      console.error('MongoDB connection error:', err);
    });

    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    return false;
  }
}
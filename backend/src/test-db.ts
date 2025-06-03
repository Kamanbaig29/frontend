import { connectDatabase } from './config/database';
import { AutoTokenBuy } from './models/AutoTokenBuy';
import { TokenStats } from './models/TokenStats';
import { WalletToken } from './models/WalletToken';

async function testDatabase() {
  try {
    await connectDatabase();

    // Test AutoTokenBuy
    const testBuy = await AutoTokenBuy.create({
      mint: 'test-mint-' + Date.now(),
      creator: 'test-creator',
      bondingCurve: 'test-curve',
      curveTokenAccount: 'test-curve-account',
      userTokenAccount: 'test-user-account',
      metadata: 'test-metadata',
      decimals: 9,
      supply: '1000000',
      buyTimestamp: Date.now(),
      transactionSignature: 'test-signature',
      status: 'bought'
    });

    // Test TokenStats
    const testStats = await TokenStats.create({
      mint: 'test-mint-' + Date.now(),
      buyPrice: 0.1,
      currentPrice: 0.15,
      profitLoss: 0.05,
      profitPercentage: 50,
      holdingTime: '1h',
      status: 'holding',
      lastUpdated: Date.now()
    });

    // Test WalletToken
    const testWallet = await WalletToken.create({
      mint: 'test-mint-' + Date.now(),
      amount: '1000000',
      valueInSol: 0.1,
      buyPrice: 0.1,
      lastPrice: 0.15,
      lastUpdated: Date.now(),
      metadata: {
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 9
      }
    });

    console.log('\n✅ Test documents created successfully');
    console.log('AutoTokenBuy:', testBuy._id);
    console.log('TokenStats:', testStats._id);
    console.log('WalletToken:', testWallet._id);

    // Clean up
    await Promise.all([
      AutoTokenBuy.deleteOne({ _id: testBuy._id }),
      TokenStats.deleteOne({ _id: testStats._id }),
      WalletToken.deleteOne({ _id: testWallet._id })
    ]);

    console.log('\n🧹 All test data cleaned up');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testDatabase();
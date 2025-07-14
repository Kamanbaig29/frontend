// import { startPriceUpdateService } from './helper-functions/priceUpdateService';
// import { connectDatabase } from './config/database';
// import dotenv from 'dotenv';

// // Load environment variables
// dotenv.config();

// const runTest = async () => {
//     console.log('Connecting to database...');
//     await connectDatabase();
//     console.log('Database connected.');

//     console.log('Starting price update service to run indefinitely...');
//     // The service will now run continuously with the default 30-second interval.
//     startPriceUpdateService(); 
// };

// runTest().catch(error => {
//     console.error("Failed to run price service test:", error);
//     process.exit(1);
// });

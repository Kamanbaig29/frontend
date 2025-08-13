import { startPumpFunTokenWorker } from './pumpFunTokenWorker';
import { WebSocketServer } from 'ws';
import { connectDatabase } from '../config/database';

// Connect to MongoDB using proper config
connectDatabase()
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.error('Database connection failed:', err));

// Create dummy WebSocket server
const wss = new WebSocketServer({ port: 8080 });

console.log('Starting PumpFun Token Worker Test...');

// Start the worker
startPumpFunTokenWorker(wss);

console.log('Worker started! Listening for new PumpFun tokens...');
console.log('Press Ctrl+C to stop');
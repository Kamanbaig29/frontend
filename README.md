# Solana Token Sniper Bot Dashboard

A real-time dashboard for monitoring and sniping Solana tokens with automatic detection and purchase capabilities.

## Prerequisites

- Node.js 16+ installed
- npm or yarn package manager
- Solana CLI tools installed
- A Solana wallet with SOL for transactions

## Environment Setup

Create a `.env` file in both frontend and backend directories:

### Frontend (.env)
```env
VITE_WS_URL=ws://localhost:3001
VITE_API_URL=http://localhost:3001
```

### Backend (.env)
```env
PORT=3001
RPC_URL=your_solana_rpc_url
PRIVATE_KEY=your_wallet_private_key
MEMEHOME_PROGRAM_ID=your_program_id
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd frontend
```

2. Install dependencies for both frontend and backend:
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
```

## Starting the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend WebSocket: ws://localhost:3001

## Features

- Real-time token detection
- Automatic token purchase
- Transaction status monitoring
- Copy-to-clipboard functionality for addresses
- Dark theme interface
- Status indicators for transactions

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + TypeScript
- Blockchain: Solana Web3.js
- UI Framework: Material-UI (MUI)
- State Management: React Context
- Real-time Updates: WebSocket

## Development

To run in development mode with hot reloading:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Security Notes

- Never commit your `.env` files
- Keep your private keys secure
- Use environment variables for sensitive data
- Monitor your wallet balance
- Set appropriate transaction limits

## Troubleshooting

- Ensure Solana RPC endpoint is responsive
- Check WebSocket connection in browser console
- Verify wallet has sufficient SOL balance
- Monitor backend logs for transaction status

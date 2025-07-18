# Solana Token Sniper Bot Dashboard

A full-stack, real-time dashboard for monitoring, filtering, and sniping Solana tokens with advanced automation, filtering, and transaction management.  
This project includes a React frontend, a Node.js/TypeScript backend, and deep integration with the Solana blockchain.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [Frontend Details](#frontend-details)
- [Backend Details](#backend-details)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Real-time token detection**: Instantly detects new token launches on Solana.
- **Automatic & manual token purchase**: Auto-buy tokens based on user-defined filters, or buy manually.
- **Advanced buy/sell filters**: Filter by market cap, buyers, token age, dev whitelist/blacklist, LP lock, and more.
- **Auto-sell with profit/loss triggers**: Set take profit, stop loss, trailing stop, and auto-sell percentages.
- **Transaction status monitoring**: See live status of all buy/sell actions.
- **Wallet integration**: Connects to your Solana wallet; supports Phantom login and bot wallet management.
- **Preset management**: Save and switch between multiple buy/sell presets.
- **Copy-to-clipboard for addresses**: Easily copy token and wallet addresses.
- **Dark theme UI**: Modern, responsive, and visually appealing interface.
- **WebSocket-powered updates**: All data is live and real-time.
- **User authentication**: Secure login with JWT and wallet-based auth.
- **Backend API**: RESTful endpoints for all major actions and filters.
- **Admin/Dev features**: Whitelist/blacklist devs, block tokens, and more.

---

## Architecture

- **Frontend**: React + TypeScript + Vite, using Material-UI for UI, React Context for state, and WebSocket for real-time updates.
- **Backend**: Node.js + TypeScript + Express, with MongoDB for user/filter storage, and Solana Web3.js for blockchain interaction.
- **Blockchain**: Solana, using custom smart contract (IDL included) and direct on-chain calls for token actions.
- **Communication**: REST API for CRUD, WebSocket for real-time events (token launches, transaction status, etc).

---

## Project Structure

```
frontend/
  backend/
    src/
      action/           # Blockchain buy/sell logic
      config/           # DB and app config
      controllers/      # API controllers (auth, filters, etc)
      helper-functions/ # Workers, price updates, etc
      idl/              # Solana program IDL
      middleware/       # Auth, etc
      models/           # Mongoose models (User, Presets, Filters)
      routes/           # Express routes
      trade-bot/        # Token listener, WebSocket handlers
      utils/            # Solana utils, email, etc
      wallet/           # Keypair storage
    package.json
    tsconfig.json
  src/
    components/         # React UI components
    context/            # React Context (WebSocket, Bot)
    types/              # TypeScript types
    assets/             # Images, icons
    App.tsx             # Main app logic
    main.tsx            # Entry point
  public/
  package.json
  README.md
```

---

## Installation & Setup

### Prerequisites

- Node.js 16+
- npm or yarn
- Solana CLI tools
- MongoDB (local or remote)
- A funded Solana wallet

### 1. Clone the repository

```bash
git clone <repository-url>
cd frontend
```

### 2. Install dependencies

```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

### 3. Environment Variables

Create `.env` files in both `frontend/` and `backend/` directories.

#### Frontend `.env`
```
VITE_WS_URL=ws://localhost:3001
VITE_API_URL=http://localhost:3001
```

#### Backend `.env`
```
PORT=3001
RPC_URL=your_solana_rpc_url
PRIVATE_KEY=your_wallet_private_key
MEMEHOME_PROGRAM_ID=your_program_id
MONGO_URI=your_mongodb_connection_string
```

---

## Usage

### 1. Start the backend

```bash
cd backend
npm run dev
```

### 2. Start the frontend

```bash
cd frontend
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API & WebSocket: [http://localhost:3001](http://localhost:3001)

---

## Frontend Details

- **Login**: Supports Phantom wallet login and JWT-based sessions.
- **Token List**: View all detected tokens, with real-time updates.
- **My Tokens**: See tokens you own, with live price, P/L, and sell controls.
- **Buy/Sell Panel**: Enter buy amounts, select sell percentages, and trigger manual trades.
- **Filter Panel**: Set buy/sell filters (market cap, buyers, age, LP lock, whitelist/blacklist, etc).
- **Presets**: Save up to 3 buy and 3 sell presets per user.
- **Auto-Buy**: Enable/disable, set buffer amount, and configure advanced options.
- **Auto-Sell**: Set take profit, stop loss, trailing stop, and auto-sell percent per token.
- **Notifications**: Snackbar and banner notifications for all major events (token detected, buy/sell success, errors, etc).
- **WebSocket**: All token and transaction data is live and real-time.

---

## Backend Details

- **Express API**: Handles user auth, filter management, token info, and transaction endpoints.
- **WebSocket Server**: Pushes real-time events to frontend (token launches, price updates, buy/sell status).
- **Solana Integration**: Uses Solana Web3.js and custom program for all on-chain actions.
- **Workers**: Background jobs for auto-sell, price updates, and token monitoring.
- **MongoDB Models**: Users, filter presets, buy/sell presets, and token data.
- **Security**: JWT auth, password hashing, and wallet key encryption.
- **Admin/Dev Tools**: Whitelist/blacklist devs, block tokens, and manage global settings.

---

## Security Notes

- **Never commit your `.env` files or private keys.**
- Use strong passwords and enable 2FA on your wallet.
- Monitor your wallet balance and transaction history.
- Set appropriate buy/sell limits and filters to avoid loss.
- All sensitive data is stored securely and never exposed to the frontend.

---

## Troubleshooting

- **Solana RPC issues**: Ensure your RPC endpoint is working and not rate-limited.
- **WebSocket errors**: Check browser console and backend logs.
- **MongoDB connection**: Verify your `MONGO_URI` and DB status.
- **Wallet issues**: Make sure your wallet is funded and accessible.
- **Transaction stuck**: Check Solana explorer for transaction status.

---

## Development

- Hot reloading for both frontend and backend.
- Modular codebase for easy extension.
- TypeScript everywhere for safety and autocompletion.
- Linting and formatting via ESLint and Prettier.

### Run in development mode

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

---

## Contributing

Pull requests and issues are welcome!  
Please open an issue for bugs, feature requests, or questions.

---

## License

MIT License (see LICENSE file)

---

**For more details, see the code and comments in each directory. This README covers all major features, setup, and usage.**  
If you need a section expanded (e.g., API docs, advanced filters, or deployment), let me know!

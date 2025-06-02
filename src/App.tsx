import React, { useState } from 'react';
import { Button } from '@mui/material'
import { BotProvider } from './context/BotContext';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { ManualBuyForm } from './components/ManualBuyForm';

export const App = () => {
  const [tradingMode, setTradingMode] = useState<'manual' | 'automatic' | null>(null);

  const handleModeSelect = (mode: 'manual' | 'automatic') => {
    setTradingMode(mode);
  };

  const handleBackHome = () => {
    // Send reset message to backend
    const ws = new WebSocket('ws://localhost:3001');
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'RESET_STATE'
      }));
      ws.close();
    };
    setTradingMode(null);
  };

  return (
    <BotProvider>
      <div
        style={{
          minHeight: '100vh',
          minWidth: '100vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a1a'
        }}
      >
        {!tradingMode ? (
          <LandingPage onSelectMode={handleModeSelect} />
        ) : tradingMode === 'automatic' ? (
          <Dashboard onBackHome={handleBackHome} />
        ) : (
          <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Manual Trading</h1>
                <p className="text-sm text-gray-400 mt-1">
                  Buy tokens manually by providing mint address and amount
                </p>
              </div>
              <Button
                onClick={handleBackHome}
                variant="contained"
                sx={{
                  bgcolor: '#483D8B',
                  '&:hover': { bgcolor: '#372B7A' }
                }}
              >
                Back to Home
              </Button>
            </div>
            <ManualBuyForm />
          </div>
        )}
      </div>
    </BotProvider>
  );
};

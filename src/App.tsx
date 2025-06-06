import React, { useState } from 'react';
import { Button } from '@mui/material';
import { BotProvider } from './context/BotContext';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { ManualBuyForm } from './components/ManualBuyForm';
import { Stats } from './components/Stats';
import { ManualSellList } from './components/ManualSellList';
// import { AutomaticSellDashboard } from './components/AutomaticSellDashboard'; // Uncomment if needed

export const App = () => {
  const [currentView, setCurrentView] = useState<
    'landing' | 'automatic' | 'manual' | 'manualSell' | 'automaticSell' | 'stats'
  >('landing');

  const handleModeSelect = (mode: 'manual' | 'automatic') => {
    setCurrentView(mode);
  };

  const handleViewStats = () => {
    setCurrentView('stats');
  };

  const handleManualSell = () => {
    setCurrentView('manualSell');
  };

  const handleAutomaticSell = () => {
    setCurrentView('automaticSell');
  };

  const handleBackHome = () => {
    const ws = new WebSocket('ws://localhost:3001');
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'RESET_STATE' }));
      ws.close();
    };
    setCurrentView('landing');
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
          background: '#1a1a1a',
        }}
      >
        {currentView === 'landing' && (
          <LandingPage
            onSelectMode={handleModeSelect}
            onViewStats={handleViewStats}
            onManualSell={handleManualSell}
            onAutomaticSell={handleAutomaticSell}
          />
        )}

        {currentView === 'automatic' && <Dashboard onBackHome={handleBackHome} />}

        {currentView === 'manual' && (
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
                  '&:hover': { bgcolor: '#372B7A' },
                }}
              >
                Back to Home
              </Button>
            </div>
            <ManualBuyForm />
          </div>
        )}

        {currentView === 'manualSell' && (
          <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Manual Sell</h1>
                <p className="text-sm text-gray-400 mt-1">
                  Sell tokens manually by selecting from token list
                </p>
              </div>
              <Button
                onClick={handleBackHome}
                variant="contained"
                sx={{
                  bgcolor: '#483D8B',
                  '&:hover': { bgcolor: '#372B7A' },
                }}
              >
                Back to Home
              </Button>
            </div>
            <ManualSellList />
          </div>
        )}

        {currentView === 'automaticSell' && (
          <div className="text-white text-xl font-bold">
            Automatic Sell Mode (UI to be implemented)
            <Button
              onClick={handleBackHome}
              variant="contained"
              sx={{
                bgcolor: '#483D8B',
                '&:hover': { bgcolor: '#372B7A' },
                ml: 4,
              }}
            >
              Back to Home
            </Button>
          </div>
          // Replace with <AutomaticSellDashboard /> later if needed
        )}

        {currentView === 'stats' && <Stats onBackHome={handleBackHome} />}
      </div>
    </BotProvider>
  );
};

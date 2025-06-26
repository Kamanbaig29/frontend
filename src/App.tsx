import React, { useState, useEffect } from 'react';
import { Button } from '@mui/material';
import { BotProvider } from './context/BotContext';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { ManualBuyForm } from './components/ManualBuyForm';
import { Stats } from './components/Stats';
import { ManualSellList } from './components/ManualSellList';
import { WebSocketProvider, useWebSocket } from './context/webSocketContext';
import { AutomaticSellDashboard } from './components/AutomaticSellDashboard';
import LoginPage from './components/LoginPage';
// import { AutomaticSellDashboard } from './components/AutomaticSellDashboard'; // Uncomment if needed

// Create a new component that uses useWebSocket
const AppContent = () => {
  const [currentView, setCurrentView] = useState<
    | 'login'
    | 'landing'
    | 'automatic'
    | 'manual'
    | 'manualSell'
    | 'automaticSell'
    | 'stats'
  >('login');

  const { sendMessage } = useWebSocket();
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('authToken'));

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
    sendMessage({ type: 'RESET_STATE' });
    setCurrentView('landing');
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setCurrentView('landing');
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setIsLoggedIn(false);
    setCurrentView('login');
  };

  useEffect(() => {
    if (isLoggedIn) {
      setCurrentView('landing');
    }
  }, [isLoggedIn]);

  //console.log('AppContent rendered', { isLoggedIn, currentView });

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
        {!isLoggedIn && (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        )}

        {currentView === 'landing' && (
          <div>
            <button
              onClick={handleLogout}
              className="absolute top-4 right-4 px-4 py-2 bg-red-600 text-white rounded"
            >
              Logout
            </button>
            <LandingPage
              onSelectMode={handleModeSelect}
              onViewStats={handleViewStats}
              onManualSell={handleManualSell}
              onAutomaticSell={handleAutomaticSell}
            />
          </div>
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
          <AutomaticSellDashboard onBackHome={handleBackHome} />
        )}

        {currentView === 'stats' && <Stats onBackHome={handleBackHome} />}
      </div>
    </BotProvider>
  );
};

// Main App component that provides the WebSocket context
export const App = () => {
  return (
    
    <WebSocketProvider>
      <AppContent />
    </WebSocketProvider>
  );
};

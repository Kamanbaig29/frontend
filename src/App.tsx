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
//import WalletInfo from './components/walletInfo';
import WalletButton from './components/walletButton';
import { Typography } from '@mui/material';
import ActivePresetBar from "./components/ActivePresetBar";
// import { AutomaticSellDashboard } from './components/AutomaticSellDashboard'; // Uncomment if needed

/*function sendSetMode(ws: WebSocket | null, mode: 'manual' | 'automatic') {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'SET_MODE', mode }));
  } else if (ws) {
    ws.addEventListener('open', function handler() {
      ws.send(JSON.stringify({ type: 'SET_MODE', mode }));
      ws.removeEventListener('open', handler);
    });
  }
}*/

// Create a new component that uses useWebSocket
const AppContent = () => {
  const [currentView, setCurrentView] = useState<
    | 'login'
    | 'landing'
    | 'selectBuyMode'
    | 'selectSellMode'
    | 'automatic'
    | 'manual'
    | 'manualSell'
    | 'automaticSell'
    | 'stats'
  >('login');

  const { ws, isAuthenticated, authenticate, status } = useWebSocket();
  const token = localStorage.getItem('token');
  const [isLoggedIn, setIsLoggedIn] = useState(!!token);

  const [buyPresets, setBuyPresets] = useState<any[]>([]);
  const [sellPresets, setSellPresets] = useState<any[]>([]);
  const [activeBuyPreset, setActiveBuyPreset] = useState<number>(0);
  const [activeSellPreset, setActiveSellPreset] = useState<number>(0);

  const handleModeSelect = (mode: 'manual' | 'automatic') => {
    if (ws && isAuthenticated) {
      console.log(`[AppContent] Sending SET_MODE: ${mode}`);
      ws.send(JSON.stringify({ type: 'SET_MODE', mode }));
      setCurrentView(mode);
    } else {
      console.error('[AppContent] Cannot send SET_MODE. WebSocket not open or user not authenticated.');
    }
  };

  const handleGoToBuySelection = () => setCurrentView('selectBuyMode');
  const handleGoToSellSelection = () => setCurrentView('selectSellMode');
  const handleViewStats = () => setCurrentView('stats');
  const handleManualSell = () => setCurrentView('manualSell');
  const handleAutomaticSell = () => setCurrentView('automaticSell');
  const handleBackHome = () => setCurrentView('landing');

  const handleLoginSuccess = () => {
    const token = localStorage.getItem('token');
    if (token) {
      console.log('[AppContent] Login successful. Calling authenticate and starting services...');
      
      // Call start-services API
      fetch('http://localhost:4000/api/bot/start-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })
      .then(res => res.json())
      //.then(data => console.log('Bot services started:', data))
      .catch(error => console.error('Failed to start bot services:', error));

      // Authenticate WebSocket
      authenticate(token);
    }
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('http://localhost:4000/api/bot/stop-services', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }).then(res => res.json())
        .then(data => console.log('Bot services stopped:', data))
        .catch(err => console.error('Failed to stop bot services:', err));
    }

    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setCurrentView('login');
  };

  useEffect(() => {
    if (isLoggedIn && isAuthenticated) {
      setCurrentView('landing');
    }
  }, [isLoggedIn, isAuthenticated]);

  useEffect(() => {
    if (!token) setIsLoggedIn(false);
  }, [token]);

  useEffect(() => {
    if (!ws || !isAuthenticated) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "PRESETS") {
          setBuyPresets(data.buyPresets);
          setSellPresets(data.sellPresets);
          setActiveBuyPreset(data.activeBuyPreset);
          setActiveSellPreset(data.activeSellPreset);
        }
        if (data.type === "PRESET_UPDATED") {
          if (data.mode === "buy") {
            setBuyPresets(prev => {
              const updated = [...prev];
              updated[data.presetIndex] = { ...updated[data.presetIndex], ...data.settings };
              return updated;
            });
          } else if (data.mode === "sell") {
            setSellPresets(prev => {
              const updated = [...prev];
              updated[data.presetIndex] = { ...updated[data.presetIndex], ...data.settings };
              return updated;
            });
          }
          ws.send(JSON.stringify({ type: "GET_PRESETS" }));
        }
      } catch {}
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, isAuthenticated]);

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
          paddingTop: '40px',
        }}
      >
        {!token ? (
          <LoginPage onLoginSuccess={() => setIsLoggedIn(true)} />
        ) : !isAuthenticated || status !== "connected" ? (
          <div>Loading...</div>
        ) : (
          <>
            <ActivePresetBar
              activeBuyPreset={activeBuyPreset}
              activeSellPreset={activeSellPreset}
              buyPresets={buyPresets}
              sellPresets={sellPresets}
              setActiveBuyPreset={setActiveBuyPreset}
              setActiveSellPreset={setActiveSellPreset}
              showBuyPresetButtons={currentView === 'manual' || currentView === 'automatic'}
              showSellPresetButtons={currentView === 'manualSell' || currentView === 'automaticSell'}
              ws={ws}
            />
            {currentView === 'landing' && (
              <div>
                <WalletButton onLogout={handleLogout} />
                <LandingPage
                  onBuyClick={handleGoToBuySelection}
                  onSellClick={() => setCurrentView('automaticSell')}
                  onViewStats={handleViewStats}
                />
              </div>
            )}

            {currentView === 'selectBuyMode' && (
              <div className="text-center">
                <Typography variant="h4" color="white" gutterBottom>Select Buy Mode</Typography>
                <div className="space-x-4 mt-4">
                  <Button
                    variant="contained"
                    onClick={() => handleModeSelect('automatic')}
                    disabled={!isAuthenticated}
                  >
                    Auto-Snipe
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => handleModeSelect('manual')}
                    disabled={!isAuthenticated}
                  >
                    Manual Buy
                  </Button>
                </div>
                {!isAuthenticated && <Typography sx={{ color: 'yellow', mt: 2 }}>Authenticating...</Typography>}
                <Button onClick={handleBackHome} variant="text" sx={{ color: 'white', mt: 4 }}>Back</Button>
              </div>
            )}

            {currentView === 'selectSellMode' && (
              <div className="text-center">
                <Typography variant="h4" color="white" gutterBottom>Select Sell Mode</Typography>
                <div className="space-x-4 mt-4">
                  <Button
                    variant="contained"
                    onClick={handleAutomaticSell}
                    disabled={!isAuthenticated}
                  >
                    Auto-Sell
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleManualSell}
                    disabled={!isAuthenticated}
                  >
                    Manual Sell
                  </Button>
                </div>
                {!isAuthenticated && <Typography sx={{ color: 'yellow', mt: 2 }}>Authenticating...</Typography>}
                <Button onClick={handleBackHome} variant="text" sx={{ color: 'white', mt: 4 }}>Back</Button>
              </div>
            )}

            {currentView === 'automatic' && (
              <div>
                <WalletButton onLogout={handleLogout} />
                <Dashboard
                  onBackHome={handleBackHome}
                  activeBuyPreset={activeBuyPreset}
                  buyPresets={buyPresets}
                />
              </div>
            )}

            {currentView === 'manual' && (
              <div className="container mx-auto p-4">
                <WalletButton onLogout={handleLogout} />
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
                <ManualBuyForm
                  activeBuyPreset={activeBuyPreset}
                  buyPresets={buyPresets}
                />
              </div>
            )}

            {currentView === 'manualSell' && (
              <div className="container mx-auto p-4">
                <WalletButton onLogout={handleLogout} />
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
              <div>
                <WalletButton onLogout={handleLogout} />
                <AutomaticSellDashboard
                  onBackHome={handleBackHome}
                  activeSellPreset={activeSellPreset}
                  sellPresets={sellPresets}
                />
              </div>
            )}

            {currentView === 'stats' && (
              <div>
                <WalletButton onLogout={handleLogout} />
                <Stats onBackHome={handleBackHome} />
              </div>
            )}
          </>
        )}
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

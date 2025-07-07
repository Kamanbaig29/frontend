import React, { useEffect, useState, useContext } from 'react';
import { Button } from '@mui/material';
import { FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { WebSocketContext } from '../context/webSocketContext';
import { PublicKey, Connection } from '@solana/web3.js';
import PresetModal from './PresetModal';
import ActivePresetBar from './ActivePresetBar';
import { useWebSocket } from '../context/webSocketContext';
import SettingsIcon from '@mui/icons-material/Settings';

type Token = {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  creationTimestamp: number;
  currentPrice?: number;
  // Add more fields if you want to display them
};

interface TokenListWithAgeProps {
  onBackHome: () => void;
  walletAddress?: string;
  solBalance?: number;
}

function getAgeString(ageMs: number) {
  const totalSeconds = Math.floor(ageMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function toFullDecimalString(num: number) {
  let str = num.toString();
  if (str.includes('e') || str.includes('E')) {
    return num.toFixed(20).replace(/\.?0+$/, '');
  }
  return str;
}

const TokenListWithAge: React.FC<TokenListWithAgeProps> = ({ onBackHome, onLogout, walletAddress, solBalance }) => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // 'desc' = newest first
  const [presetModalOpen, setPresetModalOpen] = useState(false);

  // Preset state (copied from App.tsx ic)
  const {
    buyPresets = [],
    sellPresets = [],
    activeBuyPreset = 0,
    activeSellPreset = 0,
    setActiveBuyPreset,
    setActiveSellPreset,
    ws
  } = useWebSocket();

  // Fetch tokens on mount with proper authentication
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication token not found');
          setLoading(false);
          return;
        }

        const res = await fetch('http://localhost:4000/api/tokens/all', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            setError('Authentication failed. Please login again.');
            localStorage.removeItem('token');
            onLogout();
            return;
          }
          throw new Error('Failed to fetch tokens');
        }

        const data = await res.json();
        setTokens(data.tokens || []);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch tokens');
        setLoading(false);
      }
    };

    fetchTokens();
  }, [onLogout]);

  // Update "now" every second for real-time age
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === "NEW_TOKEN" && data.token) {
        setTokens(prev => {
          // Agar token already list me hai, to update karo, warna add karo
          const exists = prev.find(t => t.mint === data.token.mint);
          if (exists) {
            return prev.map(t => t.mint === data.token.mint ? data.token : t);
          }
          return [data.token, ...prev];
        });
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws]);

  useEffect(() => {
    if (ws) {
      ws.send(JSON.stringify({ type: "GET_PRESETS" }));
    }
  }, [ws]);

  // Sort tokens based on creationTimestamp and sortOrder
  const sortedTokens = [...tokens].sort((a, b) => {
    if (sortOrder === 'desc') {
      return b.creationTimestamp - a.creationTimestamp;
    } else {
      return a.creationTimestamp - b.creationTimestamp;
    }
  });

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        color: 'white'
      }}>
        <div>Loading tokens...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        color: 'white',
        gap: '16px'
      }}>
        <div style={{ color: '#ff6b6b' }}>Error: {error}</div>
        <Button 
          onClick={onBackHome}
          variant="contained"
          sx={{
            bgcolor: '#483D8B',
            '&:hover': { bgcolor: '#372B7A' },
          }}
        >
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Wallet details + Logout (below the fixed bar) */}
      {walletAddress && (
        <span style={{ color: '#FFD700', fontWeight: 600, fontSize: 16, marginLeft: 16 }}>
          💰 {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
          {typeof solBalance === 'number' && ` ${solBalance} SOL`}
        </span>
      )}

      {/* Main content wrapper */}
      <div
        style={{
          padding: 24,
          maxWidth: '1200px',
          margin: '0 auto',
          color: 'white',
          position: 'relative',
          paddingTop: 48, // <-- yeh zaroori hai, taki fixed bar ke niche content aaye
        }}
      >
        {/* Filter Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 24,
          gap: 16,
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 18 }}>Sort by:</span>
            <Button
              variant={sortOrder === 'desc' ? 'contained' : 'outlined'}
              startIcon={<FaSortAmountDown />}
              onClick={() => setSortOrder('desc')}
              sx={{ bgcolor: sortOrder === 'desc' ? '#483D8B' : undefined, color: 'white' }}
            >
              Newest First
            </Button>
            <Button
              variant={sortOrder === 'asc' ? 'contained' : 'outlined'}
              startIcon={<FaSortAmountUp />}
              onClick={() => setSortOrder('asc')}
              sx={{ bgcolor: sortOrder === 'asc' ? '#483D8B' : undefined, color: 'white' }}
            >
              Oldest First
            </Button>
          </div>
          <Button
            onClick={() => setPresetModalOpen(true)}
            sx={{
              minWidth: 0,
              padding: 1,
              borderRadius: '50%',
              background: '#fff2',
              ml: 2
            }}
          >
            <SettingsIcon sx={{ color: 'white', fontSize: 32 }} />
          </Button>
        </div>
        {/* End Filter Bar */}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 24 
        }}>
          <h2 style={{ 
            fontWeight: 'bold', 
            fontSize: 28, 
            margin: 0,
            color: 'white'
          }}>
            All MemeHome Tokens
          </h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              onClick={onBackHome}
              variant="contained"
              sx={{
                bgcolor: '#483D8B',
                '&:hover': { bgcolor: '#372B7A' },
              }}
            >
              Back to Home
            </Button>
          </div>
        </div>
        
        {sortedTokens.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px',
            color: '#888'
          }}>
            No tokens found
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20 
          }}>
            {sortedTokens.map(token => (
              <div
                key={token.mint}
                style={{
                  border: '1px solid #333',
                  borderRadius: 12,
                  padding: 20,
                  background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
              >
                {token.imageUrl && (
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <img
                      src={token.imageUrl}
                      alt={token.name}
                      style={{ 
                        width: 80, 
                        height: 80, 
                        borderRadius: 12, 
                        objectFit: 'cover',
                        border: '2px solid #333'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: 18,
                  color: 'white',
                  marginBottom: 8,
                  textAlign: 'center'
                }}>
                  {token.name}
                </div>
                
                <div style={{ 
                  fontSize: 14, 
                  color: '#888',
                  marginBottom: 8,
                  textAlign: 'center'
                }}>
                  {token.symbol}
                </div>
                
                <div style={{ 
                  fontSize: 11, 
                  color: '#666', 
                  wordBreak: 'break-all',
                  marginBottom: 12,
                  fontFamily: 'monospace'
                }}>
                  Mint: {token.mint.substring(0, 8)}...{token.mint.substring(token.mint.length - 8)}
                </div>
                
                <div style={{ 
                  fontSize: 16, 
                  color: '#4CAF50', 
                  fontWeight: 600,
                  textAlign: 'center',
                  marginBottom: 8
                }}>
                  Age: {getAgeString(now - token.creationTimestamp)}
                </div>
                
                {token.currentPrice !== undefined && (
                  <div style={{ 
                    fontSize: 16, 
                    color: '#2196F3', 
                    fontWeight: 600,
                    textAlign: 'center'
                  }}>
                    Price: ${toFullDecimalString(token.currentPrice)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <PresetModal
        open={presetModalOpen}
        onClose={() => setPresetModalOpen(false)}
        buyPresets={buyPresets}
        sellPresets={sellPresets}
        activeBuyPreset={activeBuyPreset}
        activeSellPreset={activeSellPreset}
        setActiveBuyPreset={setActiveBuyPreset}
        setActiveSellPreset={setActiveSellPreset}
      />
    </>
  );
};

export default TokenListWithAge;

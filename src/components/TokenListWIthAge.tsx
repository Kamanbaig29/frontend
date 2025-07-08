import React, { useEffect, useState } from 'react';
import { Button, TextField } from '@mui/material';
import { FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
//import { WebSocketContext } from '../context/webSocketContext';
//import { PublicKey, Connection } from '@solana/web3.js';
import PresetModal from './PresetModal';
//import ActivePresetBar from './ActivePresetBar';
import { useWebSocket } from '../context/webSocketContext';
//import SettingsIcon from '@mui/icons-material/Settings';

type Token = {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  creationTimestamp: number;
  currentPrice?: number;
  // Add more fields if you want to display them
  buyAmount?: number;
  balance?: number;
  lastUpdated?: string | number | Date;
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

const sellPercents = [10, 30, 50, 100];

const TokenListWithAge: React.FC<TokenListWithAgeProps> = ({ onBackHome, solBalance }) => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // 'desc' = newest first
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [buyAmounts, setBuyAmounts] = useState<{ [key: string]: string }>({});
  const [showMyTokens, setShowMyTokens] = useState(false);
  const [userTokens, setUserTokens] = useState<Token[]>([]);
  const [sellPercentsState, setSellPercentsState] = useState<{ [key: string]: number }>({});

  // Preset state (copied from App.tsx ic)
  const {
    buyPresets = [],
    sellPresets = [],
    activeBuyPreset = 0,
    activeSellPreset = 0,
    setActiveBuyPreset,
    setActiveSellPreset,
    ws,
    walletAddress
  } = useWebSocket();

  // Handle buy amount input change
  const handleBuyAmountChange = (mint: string, value: string) => {
    setBuyAmounts(prev => ({
      ...prev,
      [mint]: value
    }));
  };

  // Handle buy button click
  const handleBuyClick = (token: Token) => {
    const amount = buyAmounts[token.mint];
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!ws) {
      alert('WebSocket not connected');
      return;
    }
    const preset = buyPresets[activeBuyPreset] || {};
    if (!preset || Object.keys(preset).length === 0) {
      alert("No buy preset loaded! Please set your buy preset first.");
      return;
    }
    const amountLamports = Math.floor(parseFloat(amount) * 1e9);

    // Debug: See what is being sent
    console.log("Manual buy with preset:", preset);

    const toLamports = (val: string) => Math.floor(Number(val) * 1e9);

    ws.send(JSON.stringify({
      type: "MANUAL_BUY",
      mintAddress: token.mint,
      amount: amountLamports,
      slippage: preset.slippage,
      priorityFee: toLamports(preset.priorityFee),
      bribeAmount: toLamports(preset.bribeAmount),
    }));
  };

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
  }, []);

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
      if (data.type === "MANUAL_BUY_SUCCESS") {
        alert("Buy order placed successfully!");
        setBuyAmounts(prev => ({
          ...prev,
          [data.details.mint]: ''
        }));
      }
      if (data.type === "MANUAL_BUY_ERROR") {
        alert("Buy failed: " + (data.error || "Unknown error"));
      }
      if (data.type === "USER_TOKENS") {
        setUserTokens(data.tokens || []);
      }
      if (data.type === "MANUAL_SELL_SUCCESS") {
        alert("Sell order placed successfully!");
        // Optionally refresh user tokens or update UI
      }
      if (data.type === "MANUAL_SELL_ERROR") {
        alert("Sell failed: " + (data.error || "Unknown error"));
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

  // Helper for profit/loss calculation
  function getProfitLossPercent(buyPrice?: number, currentPrice?: number) {
    if (!buyPrice || !currentPrice || buyPrice === 0) return 0;
    return ((currentPrice - buyPrice) / buyPrice) * 100;
  }

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

  const handleMyTokensClick = () => {
    if (ws) {
      if (!showMyTokens) {
        ws.send(JSON.stringify({ type: "GET_USER_TOKENS" }));
        setShowMyTokens(true);
      } else {
        setShowMyTokens(false);
      }
    }
  };

  const handleSellPercentChange = (mint: string, value: number) => {
    setSellPercentsState(prev => ({ ...prev, [mint]: value }));
  };

  const handleSellClick = (token: Token) => {
    const percent = sellPercentsState[token.mint] || 100;
    if (!ws) {
      alert('WebSocket not connected');
      return;
    }
    const preset = sellPresets[activeSellPreset] || {};
    if (!preset || Object.keys(preset).length === 0) {
      alert("No sell preset loaded! Please set your sell preset first.");
      return;
    }
    const toLamports = (val: string | number) => Math.floor(Number(val) * 1e9);

    console.log("SELL walletAddress:", walletAddress);

    ws.send(JSON.stringify({
      type: "MANUAL_SELL",
      mint: token.mint,
      percent,
      walletAddress,
      slippage: preset.slippage,
      priorityFee: preset.priorityFee, // <-- yahan multiply mat karein
      bribeAmount: preset.bribeAmount, // <-- sirf yahan multiply karein
    }));
  };

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
            {/* Always show sort buttons, even in My Tokens mode */}
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
            variant="outlined"
            sx={{
              borderColor: '#483D8B',
              color: '#483D8B',
              fontWeight: 600,
              '&:hover': { bgcolor: '#483D8B', color: 'white' },
            }}
            onClick={handleMyTokensClick}
          >
            {showMyTokens ? 'All Tokens' : 'My Tokens'}
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
        
        {showMyTokens ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16 
          }}>
            {userTokens.length === 0 ? null : (
              userTokens.map(token => {
                // Assume token.balance, token.buyAmount, token.currentPrice, token.lastUpdated are present
                const buyPrice = token.buyAmount;
                const currentPrice = token.currentPrice;
                const profitLoss = getProfitLossPercent(buyPrice, currentPrice);
                const profitLossColor = profitLoss > 0 ? '#4CAF50' : profitLoss < 0 ? '#ff6b6b' : '#888';
                return (
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

                    {/* --- NEW: Token metrics --- */}
                    <div style={{ margin: '8px 0', color: '#FFD700', fontWeight: 500, fontSize: 15 }}>
                      Balance: {token.balance ?? '-'}
                    </div>
                    <div style={{ color: '#00BFFF', fontSize: 14 }}>
                      Buy Price: {buyPrice ? `$${buyPrice}` : '-'}
                    </div>
                    <div style={{ color: '#2196F3', fontSize: 14 }}>
                      Current Price: {currentPrice ? `$${currentPrice}` : '-'}
                    </div>
                    <div style={{ color: '#888', fontSize: 13 }}>
                      Last Updated: {token.lastUpdated ? new Date(token.lastUpdated).toLocaleString() : '-'}
                    </div>
                    <div style={{ color: profitLossColor, fontWeight: 600, fontSize: 15 }}>
                      P/L: {profitLoss > 0 ? '+' : ''}{profitLoss.toFixed(2)}%
                    </div>
                    {/* --- END NEW --- */}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <TextField
                        label="Amount (SOL)"
                        type="number"
                        variant="outlined"
                        size="small"
                        value={buyAmounts[token.mint] || ''}
                        onChange={(e) => handleBuyAmountChange(token.mint, e.target.value)}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: '#666',
                            },
                            '&:hover fieldset': {
                              borderColor: '#888',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#483D8B',
                            },
                          },
                          '& .MuiInputBase-input': {
                            color: 'white',
                          },
                          '& .MuiInputLabel-root': {
                            color: '#888',
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#483D8B',
                          },
                        }}
                      />
                      <Button
                        variant="contained"
                        sx={{
                          bgcolor: '#483D8B',
                          '&:hover': { bgcolor: '#372B7A' },
                          color: 'white',
                          fontWeight: 600,
                          flex: 1,
                          minWidth: 0,
                          padding: '8px 0',
                        }}
                        onClick={() => handleBuyClick(token)}
                      >
                        Buy
                      </Button>
                    </div>
                    {/* --- NEW: Sell row with dropdown and button --- */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <select
                        value={sellPercentsState[token.mint] || 100}
                        onChange={e => handleSellPercentChange(token.mint, Number(e.target.value))}
                        style={{
                          background: '#222',
                          color: 'white',
                          border: '1px solid #ff6b6b',
                          borderRadius: 6,
                          padding: '8px 12px',
                          fontWeight: 600,
                          fontSize: 15,
                          outline: 'none',
                        }}
                      >
                        {sellPercents.map(p => (
                          <option key={p} value={p}>{p}%</option>
                        ))}
                      </select>
                      <Button
                        variant="outlined"
                        fullWidth
                        sx={{
                          borderColor: '#ff6b6b',
                          color: '#ff6b6b',
                          fontWeight: 600,
                          padding: '10px 0',
                          fontSize: 16,
                          '&:hover': { bgcolor: '#ff6b6b', color: 'white' },
                        }}
                        onClick={() => handleSellClick(token)}
                      >
                        Sell
                      </Button>
                    </div>
                    {/* --- END NEW --- */}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20 
          }}>
            {sortedTokens.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px',
                color: '#888'
              }}>
                No tokens found
              </div>
            ) : (
              sortedTokens.map(token => (
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

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <TextField
                      label="Amount (SOL)"
                      type="number"
                      variant="outlined"
                      size="small"
                      value={buyAmounts[token.mint] || ''}
                      onChange={(e) => handleBuyAmountChange(token.mint, e.target.value)}
                      sx={{
                        flex: 1,
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: '#666',
                          },
                          '&:hover fieldset': {
                            borderColor: '#888',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#483D8B',
                          },
                        },
                        '& .MuiInputBase-input': {
                          color: 'white',
                        },
                        '& .MuiInputLabel-root': {
                          color: '#888',
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#483D8B',
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      sx={{
                        bgcolor: '#483D8B',
                        '&:hover': { bgcolor: '#372B7A' },
                        color: 'white',
                        fontWeight: 600,
                        flex: 1,
                        minWidth: 0,
                        padding: '8px 0',
                      }}
                      onClick={() => handleBuyClick(token)}
                    >
                      Buy
                    </Button>
                  </div>
                </div>
              ))
            )}
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

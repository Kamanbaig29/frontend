import React, { useEffect, useState, useRef } from 'react';
import { Button, TextField, Switch, FormControlLabel, Snackbar, Alert } from '@mui/material';
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
  autoSellEnabled?: boolean; // Added for backend sync
  takeProfit?: number; // Added for backend sync
  stopLoss?: number; // Added for backend sync
  autoSellPercent?: number; // Added for backend sync
  decimals?: number; // Added for backend sync
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

function formatTokenBalance(balance: number, symbol: string) {
  console.log("[DEBUG] formatTokenBalance input:", balance, symbol);
  if (balance >= 1_000_000) {
    console.log("[DEBUG] Balance M:", balance / 1_000_000);
    return `${(balance / 1_000_000).toFixed(2)}M ${symbol}`;
  }
  if (balance >= 1_000) {
    console.log("[DEBUG] Balance K:", balance / 1_000);
    return `${(balance / 1_000).toFixed(2)}K ${symbol}`;
  }
  console.log("[DEBUG] Balance:", balance);
  return `${balance} ${symbol}`;
}

const sellPercents = [10, 30, 50, 100];

const TokenListWithAge: React.FC<TokenListWithAgeProps> = ({ onBackHome, solBalance }) => {
  // All useState, useEffect, useRef, etc. go here
  const [tokens, setTokens] = useState<Token[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // 'desc' = newest first
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [buyAmounts, setBuyAmounts] = useState<{ [key: string]: string }>({});
  const [showMyTokens, setShowMyTokens] = useState(false);
  const [walletTokens, setWalletTokens] = useState<Token[]>([]);
  const [autoSellConfigs, setAutoSellConfigs] = useState<any[]>([]);
  const [userTokens, setUserTokens] = useState<Token[]>([]);
  const [sellPercentsState, setSellPercentsState] = useState<{ [key: string]: number }>({});
  const [autoBuyEnabled, setAutoBuyEnabled] = useState(false);
  const [bufferAmount, setBufferAmount] = useState<string>('');
  const [autoBuySnackbar, setAutoBuySnackbar] = useState<{ open: boolean, message: string }>({ open: false, message: '' });
  const [lastAutoBuyMint, setLastAutoBuyMint] = useState<string | null>(null);
  const [takeProfitState, setTakeProfitState] = useState<{ [key: string]: string }>({});
  const [stopLossState, setStopLossState] = useState<{ [key: string]: string }>({});
  const [autoSellPercentState, setAutoSellPercentState] = useState<{ [key: string]: string }>({});
  const [autoSellEnabledState, setAutoSellEnabledState] = useState<{ [key: string]: boolean }>({});

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

  const autoBuyEnabledRef = useRef(autoBuyEnabled);
  const bufferAmountRef = useRef(bufferAmount);
  const buyPresetsRef = useRef(buyPresets);
  const activeBuyPresetRef = useRef(activeBuyPreset);

  useEffect(() => { autoBuyEnabledRef.current = autoBuyEnabled; }, [autoBuyEnabled]);
  useEffect(() => { bufferAmountRef.current = bufferAmount; }, [bufferAmount]);
  useEffect(() => { buyPresetsRef.current = buyPresets; }, [buyPresets]);
  useEffect(() => { activeBuyPresetRef.current = activeBuyPreset; }, [activeBuyPreset]);

  const userId = localStorage.getItem('userId');

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
    setSellPercentsState(prev => ({
      ...prev,
      [mint]: value
    }));
  };

  const handleSellClick = (token: Token) => {
    const percent = sellPercentsState[token.mint];
    if (!percent || percent <= 0) {
      alert('Please select a valid sell percent');
      return;
    }
    if (!ws) {
      alert('WebSocket not connected');
      return;
    }
    const preset = sellPresets[activeSellPreset] || {};
    if (!preset || Object.keys(preset).length === 0) {
      alert("No sell preset loaded! Please set your sell preset first.");
      return;
    }

    // Debug: See what is being sent
    console.log("Manual sell with preset:", preset);

    // FIX: Send fees in SOL (not lamports) - backend expects SOL values
    ws.send(JSON.stringify({
      type: "MANUAL_SELL",
      mintAddress: token.mint,
      percent,
      slippage: preset.slippage,
      priorityFee: Number(preset.priorityFee), // Send as SOL, not lamports
      bribeAmount: Number(preset.bribeAmount), // Send as SOL, not lamports
      walletAddress,
    }));
  };

  const handleTakeProfitChange = (mint: string, value: string) => {
    setTakeProfitState(prev => ({
      ...prev,
      [mint]: value
    }));

    if (autoSellEnabledState[mint]) {
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find(t => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(value) || undefined,
        stopLoss: Number(stopLossState[mint]) || undefined,
        autoSellPercent: Number(autoSellPercentState[mint]) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find(t => t.mint === mint)?.name,
        tokenSymbol: userTokens.find(t => t.mint === mint)?.symbol,
      };
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  };

  const handleStopLossChange = (mint: string, value: string) => {
    setStopLossState(prev => ({
      ...prev,
      [mint]: value
    }));

    if (autoSellEnabledState[mint]) {
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find(t => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(takeProfitState[mint]) || undefined,
        stopLoss: Number(value) || undefined,
        autoSellPercent: Number(autoSellPercentState[mint]) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find(t => t.mint === mint)?.name,
        tokenSymbol: userTokens.find(t => t.mint === mint)?.symbol,
      };
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  };

  const handleAutoSellPercentChange = (mint: string, value: string) => {
    setAutoSellPercentState(prev => ({
      ...prev,
      [mint]: value
    }));

    if (autoSellEnabledState[mint]) {
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find(t => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(takeProfitState[mint]) || undefined,
        stopLoss: Number(stopLossState[mint]) || undefined,
        autoSellPercent: Number(value) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find(t => t.mint === mint)?.name,
        tokenSymbol: userTokens.find(t => t.mint === mint)?.symbol,
      };
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  };

  const handleAutoSellToggle = (token: Token) => {
    const enabled = !autoSellEnabledState[token.mint];
    setAutoSellEnabledState(prev => ({
      ...prev,
      [token.mint]: enabled
    }));

    if (enabled) {
      // Sync input fields with backend values
      setTakeProfitState(prev => ({
        ...prev,
        [token.mint]: token.takeProfit !== undefined ? String(token.takeProfit) : ''
      }));
      setStopLossState(prev => ({
        ...prev,
        [token.mint]: token.stopLoss !== undefined ? String(token.stopLoss) : ''
      }));
      setAutoSellPercentState(prev => ({
        ...prev,
        [token.mint]: token.autoSellPercent !== undefined ? String(token.autoSellPercent) : ''
      }));
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint: token.mint,
        buyPrice: token.buyAmount || 0,
        takeProfit: Number(takeProfitState[token.mint]) || undefined,
        stopLoss: Number(stopLossState[token.mint]) || undefined,
        autoSellPercent: Number(autoSellPercentState[token.mint]) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: token.name,
        tokenSymbol: token.symbol,
      };
      console.log('AutoSell ON payload:', payload);
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      // Optionally: update autoSellEnabled: false in DB
      const payload = {
        userId,
        walletAddress,
        mint: token.mint,
        autoSellEnabled: false
      };
      console.log('AutoSell OFF payload:', payload);
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
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
        // Always update token list
        setTokens(prev => {
          const exists = prev.find(t => t.mint === data.token.mint);
          if (exists) {
            return prev.map(t => t.mint === data.token.mint ? data.token : t);
          }
          return [data.token, ...prev];
        });

        // Only trigger auto-buy if eventType is 'launch'
        if (data.eventType === "launch") {
          console.log('NEW_TOKEN received:', data.token, 'eventType:', data.eventType);
          if (
            autoBuyEnabledRef.current &&
            bufferAmountRef.current &&
            !isNaN(Number(bufferAmountRef.current)) &&
            Number(bufferAmountRef.current) > 0 &&
            ws
          ) {
            const preset = buyPresetsRef.current[activeBuyPresetRef.current] || {};
            console.log('Auto buy check:', { autoBuyEnabled: autoBuyEnabledRef.current, bufferAmount: bufferAmountRef.current, preset, ws });
            if (preset && Object.keys(preset).length > 0) {
              const amountLamports = Math.floor(Number(bufferAmountRef.current) * 1e9);
              const toLamports = (val: string) => Math.floor(Number(val) * 1e9);
              ws.send(JSON.stringify({
                type: "MANUAL_BUY",
                mintAddress: data.token.mint,
                amount: amountLamports,
                slippage: preset.slippage,
                priorityFee: toLamports(preset.priorityFee),
                bribeAmount: toLamports(preset.bribeAmount),
              }));
              console.log('MANUAL_BUY sent for:', data.token.mint);
              setAutoBuySnackbar({ open: true, message: `Auto buy order placed for ${data.token.name || data.token.mint}` });
              setLastAutoBuyMint(data.token.mint);
            }
          }
        }
      }
      if (data.type === "MANUAL_BUY_SUCCESS") {
        alert("Buy order placed successfully!");
        setBuyAmounts(prev => ({
          ...prev,
          [data.details.mint]: ''
        }));
        // Show snackbar if this was an auto buy
        if (lastAutoBuyMint && data.details.mint === lastAutoBuyMint) {
          setAutoBuySnackbar({ open: true, message: 'Auto buy order successful!' });
          setLastAutoBuyMint(null);
        }
      }
      if (data.type === "MANUAL_BUY_ERROR") {
        alert("Buy failed: " + (data.error || "Unknown error"));
      }
      if (data.type === "USER_TOKENS") {
        setWalletTokens(data.tokens || []);
      }
      if (data.type === "AUTO_SELL_TRIGGERED") {
        // Auto-sell triggered notification
        setAutoBuySnackbar({ open: true, message: `Auto sell triggered for ${data.tokenName || data.mint}! P/L: ${data.profitLoss?.toFixed(2)}%` });
      }
      if (data.type === "AUTO_SELL_SUCCESS") {
        // Auto-sell completed successfully
        setAutoBuySnackbar({ open: true, message: `Auto sell completed! Received ${data.actualSolReceived?.toFixed(6)} SOL` });
      }
      if (data.type === "AUTO_SELL_DISABLED") {
        // Auto-sell disabled notification
        setAutoBuySnackbar({ open: true, message: `Auto sell disabled for ${data.tokenName || data.mint}` });
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

  useEffect(() => {
    // Jab bhi userTokens update ho, state ko backend ki value se sync karo
    const newAutoSellEnabledState: { [key: string]: boolean } = {};
    const newTakeProfitState: { [key: string]: string } = {};
    const newStopLossState: { [key: string]: string } = {};
    const newAutoSellPercentState: { [key: string]: string } = {};

    userTokens.forEach(token => {
      newAutoSellEnabledState[token.mint] = !!token.autoSellEnabled;
      newTakeProfitState[token.mint] = token.takeProfit !== undefined ? String(token.takeProfit) : '';
      newStopLossState[token.mint] = token.stopLoss !== undefined ? String(token.stopLoss) : '';
      newAutoSellPercentState[token.mint] = token.autoSellPercent !== undefined ? String(token.autoSellPercent) : '';
    });

    setAutoSellEnabledState(newAutoSellEnabledState);
    setTakeProfitState(newTakeProfitState);
    setStopLossState(newStopLossState);
    setAutoSellPercentState(newAutoSellPercentState);
  }, [userTokens]);

  useEffect(() => {
    if (!showMyTokens) return;
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auto-sell/user/${userId}`)
      .then(res => res.json())
      .then(data => {
        setAutoSellConfigs(data.autoSells || []);
      });
  }, [showMyTokens]);

  useEffect(() => {
    // Merge walletTokens and autoSellConfigs
    if (!showMyTokens) return;
    const merged = walletTokens.map(token => {
      const config = autoSellConfigs.find(c => c.mint === token.mint);
      return {
        ...token,
        autoSellEnabled: config?.autoSellEnabled || false,
        takeProfit: config?.takeProfit,
        stopLoss: config?.stopLoss,
        autoSellPercent: config?.autoSellPercent,
        // ...baaki fields agar chahiye
      };
    });
    setUserTokens(merged);
  }, [walletTokens, autoSellConfigs, showMyTokens]);

  useEffect(() => {
    if (!showMyTokens) return;
    userTokens.forEach(token => {
      if (autoSellEnabledState[token.mint]) {
        const preset = sellPresets[activeSellPreset] || {};
        const payload = {
          userId,
          walletAddress,
          mint: token.mint,
          buyPrice: token.buyAmount || 0,
          takeProfit: Number(takeProfitState[token.mint]) || undefined,
          stopLoss: Number(stopLossState[token.mint]) || undefined,
          autoSellPercent: Number(autoSellPercentState[token.mint]) || 100,
          autoSellEnabled: true,
          slippage: preset.slippage || 5,
          priorityFee: preset.priorityFee || 0.001,
          bribeAmount: preset.bribeAmount || 0,
          tokenName: token.name,
          tokenSymbol: token.symbol,
        };
        // === YAHAN DEBUG ENTRY DALEIN ===
        console.log('Preset change POST:', payload, 'preset:', preset);
        const API_URL = import.meta.env.VITE_API_BASE_URL;
        fetch(`${API_URL}/api/auto-sell/upsert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => console.log('Upsert response:', data));
      }
    });
  }, [activeSellPreset]);

  // Sort tokens based on creationTimestamp and sortOrder
  const sortedTokens = [...tokens].sort((a, b) => {
    if (sortOrder === 'desc') {
      return b.creationTimestamp - a.creationTimestamp;
    } else {
      return a.creationTimestamp - b.creationTimestamp;
    }
  });

  const sortedUserTokens = [...userTokens].sort((a, b) => {
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

  useEffect(() => {
    // Set default sell percent to 100 for all tokens if not already set
    setSellPercentsState(prev => {
      const updated = { ...prev };
      tokens.forEach(token => {
        if (updated[token.mint] === undefined) {
          updated[token.mint] = 100;
        }
      });
      return updated;
    });
  }, [tokens]);

  return (
    <>
      {/* Wallet details + Logout (below the fixed bar) */}
      {walletAddress && (
        <span style={{ color: '#FFD700', fontWeight: 600, fontSize: 16, marginLeft: 16 }}>
          💰 {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
          {typeof solBalance === 'number' && ` ${solBalance} SOL`}
        </span>
      )}
      <Snackbar
        open={autoBuySnackbar.open}
        autoHideDuration={4000}
        onClose={() => setAutoBuySnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setAutoBuySnackbar({ open: false, message: '' })} severity="success" sx={{ width: '100%' }}>
          {autoBuySnackbar.message}
        </Alert>
      </Snackbar>

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
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}>
            All MemeHome Tokens
            <FormControlLabel
              control={
                <Switch
                  checked={autoBuyEnabled}
                  onChange={() => setAutoBuyEnabled(v => !v)}
                  color="primary"
                />
              }
              label={<span style={{ color: '#FFD700', fontWeight: 600, fontSize: 16 }}>Auto Buy Enable</span>}
              labelPlacement="end"
              sx={{ marginLeft: 2 }}
            />
            <TextField
              label="Buffer Amount (SOL)"
              type="number"
              size="small"
              value={bufferAmount}
              onChange={e => setBufferAmount(e.target.value)}
              sx={{
                width: 160,
                background: '#23242a',
                borderRadius: 2,
                input: { color: '#FFD700', fontWeight: 600, fontSize: 16 },
                label: { color: '#FFD700' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: '#FFD700',
                  },
                  '&:hover fieldset': {
                    borderColor: '#FFD700',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#FFD700',
                  },
                },
              }}
              inputProps={{ min: 0, step: 'any' }}
              disabled={!autoBuyEnabled}
            />
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
            {sortedUserTokens.length === 0 ? null : (
              sortedUserTokens.map(token => {
                // Debug log for each token
                console.log(
                  "[DEBUG] Token:",
                  token.name,
                  "| Mint:", token.mint,
                  "| Balance (raw):", token.balance,
                  "| Decimals:", token.decimals,
                  "| Symbol:", token.symbol
                );
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
                      position: 'relative', // for absolute toggle
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
                    {/* Toggle at top-right */}
                    <div style={{ position: 'absolute', top: 4, right: 12, zIndex: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!autoSellEnabledState[token.mint]}
                            onChange={() => handleAutoSellToggle(token)}
                            color="primary"
                            size="small"
                          />
                        }
                        label="Auto Sell"
                        labelPlacement="start"
                        sx={{ color: '#FFD700', fontWeight: 500, fontSize: 13 }}
                      />
                    </div>
                    {token.imageUrl && (
                      <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 32 }}>
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
                      Balance: <span style={{ color: '#FFD700', fontWeight: 500, fontSize: 15 }}>
                        {token.balance} {token.symbol}
                      </span>
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
                          flex: 1, // <-- important for equal width
                          minWidth: 0,
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
                          flex: 1, // <-- important for equal width
                          minWidth: 0,
                          bgcolor: '#483D8B',
                          '&:hover': { bgcolor: '#372B7A' },
                          color: 'white',
                          fontWeight: 600,
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
                          flex: 1,
                          minWidth: 0,
                          height: 40, // match TextField height
                          background: '#23242a', // match TextField background
                          color: 'white',
                          border: '1px solid #ff6b6b',
                          borderRadius: 6, // match TextField border radius
                          padding: '0 12px', // match TextField horizontal padding
                          fontWeight: 600,
                          fontSize: 16, // match TextField font size
                          outline: 'none',
                          appearance: 'none', // remove default arrow, you can add custom if needed
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {sellPercents.map(p => (
                          <option key={p} value={p}>{p}%</option>
                        ))}
                      </select>
                      <Button
                        variant="outlined"
                        sx={{
                          flex: 1, // <-- important for equal width
                          minWidth: 0,
                          height: 40, // match Buy button height
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
                    {/* --- NEW: Take Profit, Stop Loss, Auto Sell % row --- */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        type="number"
                        placeholder="Take Profit"
                        value={takeProfitState[token.mint] || ''}
                        onChange={e => handleTakeProfitChange(token.mint, e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: 36,
                          background: '#23242a',
                          color: 'white',
                          border: '1px solid #FFD700',
                          borderRadius: 6,
                          padding: '0 12px',
                          fontWeight: 500,
                          fontSize: 15,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        disabled={!autoSellEnabledState[token.mint]}
                      />
                      <input
                        type="number"
                        placeholder="Stop Loss %"
                        value={stopLossState[token.mint] || ''}
                        onChange={e => handleStopLossChange(token.mint, e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: 36,
                          background: '#23242a',
                          color: 'white',
                          border: '1px solid #ff6b6b',
                          borderRadius: 6,
                          padding: '0 12px',
                          fontWeight: 500,
                          fontSize: 15,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        disabled={!autoSellEnabledState[token.mint]}
                      />
                      <input
                        type="number"
                        placeholder="Auto Sell %"
                        value={autoSellPercentState[token.mint] || ''}
                        onChange={e => handleAutoSellPercentChange(token.mint, e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: 36,
                          background: '#23242a',
                          color: 'white',
                          border: '1px solid #00BFFF',
                          borderRadius: 6,
                          padding: '0 12px',
                          fontWeight: 500,
                          fontSize: 15,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        disabled={!autoSellEnabledState[token.mint]}
                      />
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

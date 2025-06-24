// src/components/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useBot } from '../context/BotContext';
import { useWebSocket } from '../context/webSocketContext';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  Typography,
  Box,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
} from '@mui/material';

interface DashboardProps {
  onBackHome: () => void;
}

interface AutoSnipeSettings {
  buyAmount: number;
  slippage: number;
  priorityFee: number;
  bribeAmount: number;
  autoBuyEnabled: boolean;
}

type StatusColor = 'success' | 'warning' | 'error' | 'default';

const getStatusColor = (status: string): StatusColor => {
  switch (status) {
    case 'bought':
      return 'success';
    case 'buying':
      return 'warning';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
};

export const Dashboard: React.FC<DashboardProps> = ({ onBackHome }) => {
  const { state, dispatch } = useBot();
  const { ws, status: wsStatus, sendMessage } = useWebSocket();
  const [status, setStatus] = useState('Initializing...');
  const [activeTab, setActiveTab] = useState(0);

  const [settings, setSettings] = useState<AutoSnipeSettings>({
    buyAmount: 0.1,    // Default 0.1 SOL
    slippage: 1,       // Default 1%
    priorityFee: 0,    // Default 0 SOL
    bribeAmount: 0,    // Default 0 SOL
    autoBuyEnabled: false
  });

  // Manual Buy State
  const [manualBuyMint, setManualBuyMint] = useState('');
  const [manualBuyAmount, setManualBuyAmount] = useState('');
  const [manualBuyPrivateKey, setManualBuyPrivateKey] = useState('');
  const [manualBuySlippage, setManualBuySlippage] = useState('1');
  const [manualBuyPriorityFee, setManualBuyPriorityFee] = useState('0.001');
  const [manualBuyBribeAmount, setManualBuyBribeAmount] = useState('0');
  const [manualBuyLoading, setManualBuyLoading] = useState(false);
  const [manualBuyError, setManualBuyError] = useState<string | null>(null);
  const [manualBuySuccess, setManualBuySuccess] = useState<string | null>(null);

  useEffect(() => {
    if (ws && wsStatus === 'connected') {
      sendMessage({
        type: 'SET_MODE',
        mode: 'automatic'
      });

      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'NEW_TOKEN') {
          dispatch({
            type: 'ADD_TOKEN',
            payload: {
              ...data.tokenData,
              timestamp: Date.now(),
              status: 'Detected',
              executionTimeMs: null,
              transactionSignature: null
            }
          });
        }
        
        if (data.type === 'AUTO_BUY_SUCCESS') {
          dispatch({
            type: 'UPDATE_TOKEN',
            payload: {
              mint: data.details.mint,
              status: 'Bought',
              executionTimeMs: data.details.executionTimeMs,
              transactionSignature: data.details.txSignature,
              buyTime: data.details.buyTime,
              buyPrice: data.details.buyPrice,
              tokenAmount: data.details.tokenAmount,
              // Include all other token details
              creator: data.details.creator,
              bondingCurve: data.details.bondingCurve,
              curveTokenAccount: data.details.curveTokenAccount,
              metadata: data.details.metadata,
              decimals: data.details.decimals,
              supply: data.details.supply
            }
          });
        }

        // Handle manual buy responses
        if (data.type === 'MANUAL_BUY_SUCCESS') {
          setManualBuySuccess(`Token bought successfully! Transaction: ${data.signature}. Time: ${data.details.executionTimeMs}ms`);
          setManualBuyMint('');
          setManualBuyAmount('');
          setManualBuyPrivateKey('');
          setManualBuyLoading(false);
        } else if (data.type === 'MANUAL_BUY_ERROR') {
          setManualBuyError(data.error || 'Transaction failed');
          setManualBuyLoading(false);
        }
      };

      ws.addEventListener('message', handleMessage);
      return () => {
        if (ws) {
          ws.removeEventListener('message', handleMessage);
        }
      };
    }
  }, [ws, wsStatus, dispatch, sendMessage]);

  const handleSettingsChange = (field: keyof AutoSnipeSettings, value: number | boolean) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    
    if (ws && wsStatus === 'connected') {
      sendMessage({
        type: 'UPDATE_AUTO_SNIPE_SETTINGS',
        settings: newSettings
      });
    }
  };

  const handleManualBuy = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualBuyLoading(true);
    setManualBuyError(null);
    setManualBuySuccess(null);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setManualBuyError('WebSocket is not connected. Please wait or check server.');
      setManualBuyLoading(false);
      return;
    }

    if (!manualBuyMint || !manualBuyAmount || !manualBuyPrivateKey) {
      setManualBuyError('All fields are required');
      setManualBuyLoading(false);
      return;
    }

    try {
      const walletAddress = import.meta.env.VITE_BUYER_PUBLIC_KEY || '';
      if (!walletAddress) {
        setManualBuyError('Wallet address not found in environment variables');
        setManualBuyLoading(false);
        return;
      }

      const messageToSend = {
        type: 'MANUAL_BUY',
        data: {
          mintAddress: manualBuyMint,
          amount: parseFloat(manualBuyAmount),
          privateKey: manualBuyPrivateKey,
          walletAddress: walletAddress,
          slippage: parseFloat(manualBuySlippage),
          priorityFee: parseFloat(manualBuyPriorityFee),
          bribeAmount: parseFloat(manualBuyBribeAmount)
        }
      };

      console.log('Sending MANUAL_BUY message:', messageToSend);
      sendMessage(messageToSend);

    } catch (err) {
      setManualBuyError(err instanceof Error ? err.message : 'An unknown error occurred during buy request.');
      setManualBuyLoading(false);
    }
  };

  const renderAutoBuySection = () => (
    <div>
      {/* Settings Section */}
      <Paper sx={{ p: 3, mb: 4, backgroundColor: '#6A5ACD' }}>
        <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
          Auto-Snipe Settings
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Buy Amount (SOL)"
              type="number"
              value={settings.buyAmount}
              onChange={(e) => handleSettingsChange('buyAmount', parseFloat(e.target.value))}
              fullWidth
              InputProps={{ inputProps: { min: 0.01, step: 0.01 } }}
              sx={{ 
                '& .MuiOutlinedInput-root': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'white' }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Slippage (%)"
              type="number"
              value={settings.slippage}
              onChange={(e) => handleSettingsChange('slippage', parseFloat(e.target.value))}
              fullWidth
              InputProps={{ inputProps: { min: 0.1, max: 5, step: 0.1 } }}
              sx={{ 
                '& .MuiOutlinedInput-root': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'white' }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Priority Fee (SOL)"
              type="number"
              value={settings.priorityFee}
              onChange={(e) => handleSettingsChange('priorityFee', parseFloat(e.target.value))}
              fullWidth
              InputProps={{ inputProps: { min: 0, step: 0.001 } }}
              sx={{ 
                '& .MuiOutlinedInput-root': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'white' }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Bribe Amount (SOL)"
              type="number"
              value={settings.bribeAmount}
              onChange={(e) => handleSettingsChange('bribeAmount', parseFloat(e.target.value))}
              fullWidth
              InputProps={{ inputProps: { min: 0, step: 0.001 } }}
              sx={{ 
                '& .MuiOutlinedInput-root': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'white' }
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoBuyEnabled}
                  onChange={(e) => handleSettingsChange('autoBuyEnabled', e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography sx={{ color: 'white' }}>
                  Enable Auto-Buy
                </Typography>
              }
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Tokens Table */}
      <TableContainer
        component={Paper}
        sx={{
          backgroundColor: '#6A5ACD',
          '& .MuiTableCell-root': { color: 'white' },
        }}
      >
        <h2 className="text-xl font-semibold p-4 text-white">Detected Tokens</h2>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell key="status">Status</TableCell>
              <TableCell key="time">Time</TableCell>
              <TableCell key="buy-time">Buy Time (ms)</TableCell>
              <TableCell key="mint">Mint Address</TableCell>
              <TableCell key="creator">Creator</TableCell>
              <TableCell key="supply">Supply</TableCell>
              <TableCell key="bonding-curve">Bonding Curve</TableCell>
              <TableCell key="curve-token">Curve Token</TableCell>
              <TableCell key="metadata">Metadata</TableCell>
              <TableCell key="decimals">Decimals</TableCell>
              <TableCell key="tx">Tx Signature</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {state.tokens.map((token, i) => (
              <TableRow
                key={i}
                sx={{
                  '&:last-child td, &:last-child th': { border: 0 },
                  '&:hover': { backgroundColor: '#7B68EE' },
                }}
              >
                <TableCell key="status">
                  <Chip
                    label={token.status}
                    color={getStatusColor(token.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell key="time">
                  {new Date(token.timestamp).toLocaleTimeString()}
                </TableCell>
                <TableCell key="buy-time">
                  {token.executionTimeMs ? `${token.executionTimeMs}ms` : '-'}
                </TableCell>
                <TableCell key="mint">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.mint.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell key="creator">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.creator.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell key="supply">
                  <span className="text-white">{token.supply || 'Unknown'}</span>
                </TableCell>
                <TableCell key="bonding-curve">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.bondingCurve.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell key="curve-token">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.curveTokenAccount.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell key="metadata">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.metadata.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell key="decimals">{token.decimals}</TableCell>
                <TableCell key="tx">
                  {token.transactionSignature ? `${token.transactionSignature.slice(0, 8)}...` : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );

  const renderManualBuySection = () => (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        mt: 3,
        bgcolor: '#6A5ACD',
        color: 'white',
        borderRadius: 2
      }}
    >
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'white' }}>
        Manual Token Buy
      </Typography>

      <form onSubmit={handleManualBuy}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Token Mint Address"
              value={manualBuyMint}
              onChange={(e) => setManualBuyMint(e.target.value)}
              required
              fullWidth
              variant="outlined"
              sx={{
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'white' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'white' },
                  '&:hover fieldset': { borderColor: 'white' },
                  '&.Mui-focused fieldset': { borderColor: 'white' }
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Amount (SOL)"
              type="number"
              value={manualBuyAmount}
              onChange={(e) => setManualBuyAmount(e.target.value)}
              required
              fullWidth
              variant="outlined"
              inputProps={{
                min: "0.1",
                step: "0.1",
                pattern: "^[0-9]*[.]?[0-9]*$"
              }}
              sx={{
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'white' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'white' },
                  '&:hover fieldset': { borderColor: 'white' },
                  '&.Mui-focused fieldset': { borderColor: 'white' }
                }
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Wallet Private Key"
              type="password"
              value={manualBuyPrivateKey}
              onChange={(e) => setManualBuyPrivateKey(e.target.value)}
              required
              fullWidth
              variant="outlined"
              sx={{
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'white' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'white' },
                  '&:hover fieldset': { borderColor: 'white' },
                  '&.Mui-focused fieldset': { borderColor: 'white' }
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Slippage (%)"
              type="number"
              value={manualBuySlippage}
              onChange={(e) => setManualBuySlippage(e.target.value)}
              required
              fullWidth
              variant="outlined"
              inputProps={{
                min: "0.1",
                max: "100",
                step: "0.1"
              }}
              sx={{
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'white' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'white' },
                  '&:hover fieldset': { borderColor: 'white' },
                  '&.Mui-focused fieldset': { borderColor: 'white' }
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Priority Fee (SOL)"
              type="number"
              value={manualBuyPriorityFee}
              onChange={(e) => setManualBuyPriorityFee(e.target.value)}
              required
              fullWidth
              variant="outlined"
              inputProps={{
                min: "0",
                step: "0.001"
              }}
              sx={{
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'white' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'white' },
                  '&:hover fieldset': { borderColor: 'white' },
                  '&.Mui-focused fieldset': { borderColor: 'white' }
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Bribe Amount (SOL)"
              type="number"
              value={manualBuyBribeAmount}
              onChange={(e) => setManualBuyBribeAmount(e.target.value)}
              required
              fullWidth
              variant="outlined"
              inputProps={{
                min: "0",
                step: "0.001"
              }}
              sx={{
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'white' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'white' },
                  '&:hover fieldset': { borderColor: 'white' },
                  '&.Mui-focused fieldset': { borderColor: 'white' }
                }
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              disabled={manualBuyLoading || wsStatus !== 'connected'}
              fullWidth
              sx={{
                bgcolor: '#483D8B',
                '&:hover': { bgcolor: '#372B7A' },
                height: '48px',
                fontSize: '1.1rem',
                fontWeight: 'bold'
              }}
            >
              {manualBuyLoading ? <CircularProgress size={24} color="inherit" /> : 'Buy Token'}
            </Button>
          </Grid>
        </Grid>
      </form>

      {manualBuyError && (
        <Alert
          severity="error"
          sx={{
            mt: 2,
            '& .MuiAlert-message': { color: '#d32f2f' }
          }}
        >
          {manualBuyError}
        </Alert>
      )}

      {manualBuySuccess && (
        <Alert
          severity="success"
          sx={{
            mt: 2,
            '& .MuiAlert-message': { color: '#2e7d32' }
          }}
        >
          {manualBuySuccess}
        </Alert>
      )}
    </Paper>
  );

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Buy Coin Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            {status}
          </p>
        </div>
        <Button
          onClick={onBackHome}
          variant="contained"
          sx={{
            bgcolor: '#483D8B',
            '&:hover': { bgcolor: '#372B7A' },
            color: 'white'
          }}
        >
          Back to Home
        </Button>
      </div>

      <Tabs 
        value={activeTab} 
        onChange={(e, newValue) => setActiveTab(newValue)}
        sx={{
          '& .MuiTab-root': { color: 'white' },
          '& .Mui-selected': { color: '#483D8B' },
          '& .MuiTabs-indicator': { backgroundColor: '#483D8B' }
        }}
      >
        <Tab label="Auto Buy" />
        <Tab label="Manual Buy" />
      </Tabs>

      {activeTab === 0 && renderAutoBuySection()}
      {activeTab === 1 && renderManualBuySection()}
    </div>
  );
};
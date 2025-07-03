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
  CircularProgress,
} from '@mui/material';

interface DashboardProps {
  onBackHome: () => void;
  activeBuyPreset: number;
  buyPresets: any[];
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

export const Dashboard: React.FC<DashboardProps> = ({ onBackHome, activeBuyPreset, buyPresets }) => {
  const { state, dispatch } = useBot();
  const { ws, status: wsStatus, sendMessage } = useWebSocket();
  const [status, setStatus] = useState('Initializing...');
  const activePreset = buyPresets[activeBuyPreset] || {};
  const [settings, setSettings] = useState<AutoSnipeSettings>({
    buyAmount: 0.00001,
    slippage: Number(activePreset.slippage) || 1,
    priorityFee: Number(activePreset.priorityFee) || 0,
    bribeAmount: Number(activePreset.bribeAmount) || 0,
    autoBuyEnabled: false
  });

  useEffect(() => {
    if (ws && wsStatus === 'connected') {
      // Send authentication first
      const token = localStorage.getItem('token');
      if (token) {
        sendMessage({
          type: 'AUTHENTICATE',
          token: token
        });
      }

      // Then set mode to automatic
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
              status: 'bought', // <-- yahan fix karo
              executionTimeMs: data.details.executionTimeMs,
              transactionSignature: data.details.txSignature,
              buyTime: data.details.buyTime,
              buyPrice: data.details.buyPrice,
              tokenAmount: data.details.tokenAmount,
              creator: data.details.creator,
              bondingCurve: data.details.bondingCurve,
              curveTokenAccount: data.details.curveTokenAccount,
              metadata: data.details.metadata,
              decimals: data.details.decimals,
              supply: data.details.supply
            }
          });
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

  useEffect(() => {
    const activePreset = buyPresets[activeBuyPreset] || {};
    setSettings((prev) => ({
      ...prev,
      slippage: Number(activePreset.slippage) || 1,
      priorityFee: Number(activePreset.priorityFee) || 0,
      bribeAmount: Number(activePreset.bribeAmount) || 0,
    }));
  }, [activeBuyPreset, buyPresets]);

  const handleSettingsChange = (field: keyof AutoSnipeSettings, value: number | boolean) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    
    if (ws && wsStatus === 'connected') {
      sendMessage({
        type: 'UPDATE_AUTO_SNIPE_SETTINGS',
        settings: {
          autoBuyEnabled: newSettings.autoBuyEnabled,
          buyAmount: Math.floor(Number(newSettings.buyAmount) * 1_000_000_000), // <-- YEH LINE
          slippage: newSettings.slippage,
          priorityFee: Math.floor(Number(newSettings.priorityFee) * 1_000_000_000),
          bribeAmount: Math.floor(Number(newSettings.bribeAmount) * 1_000_000_000)
        }
      });
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
              InputProps={{ inputProps: { min: 0.00001, step: 0.00001 } }}
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
                    color={getStatusColor(token.status ?? 'detected')}
                    size="small"
                  />
                </TableCell>
                <TableCell key="time">
                  {new Date(token.timestamp ?? 0).toLocaleTimeString()}
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
                    <span className="font-mono text-white">{token.creator?.slice(0, 8) ?? '--------'}...</span>
                  </div>
                </TableCell>
                <TableCell key="supply">
                  <span className="text-white">{token.supply || 'Unknown'}</span>
                </TableCell>
                <TableCell key="bonding-curve">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.bondingCurve?.slice(0, 8) ?? '--------'}...</span>
                  </div>
                </TableCell>
                <TableCell key="curve-token">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.curveTokenAccount?.slice(0, 8) ?? '--------'}...</span>
                  </div>
                </TableCell>
                <TableCell key="metadata">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.metadata?.slice(0, 8) ?? '--------'}...</span>
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

  const handleBackHomeClick = () => {
    // Reset tokens and settings (frontend)
    dispatch({ type: 'RESET' });
    setSettings({
      buyAmount: 0.00001,
      slippage: Number(activePreset.slippage) || 1,
      priorityFee: Number(activePreset.priorityFee) || 0,
      bribeAmount: Number(activePreset.bribeAmount) || 0,
      autoBuyEnabled: false
    });
    setStatus('Initializing...');

    // Backend ko bhi inform karo
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendMessage({ type: 'RESET_STATE' });
    }

    onBackHome(); // Go back to home page
  };

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
          onClick={handleBackHomeClick} // <-- Use new handler
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
      {renderAutoBuySection()}
    </div>
  );
};
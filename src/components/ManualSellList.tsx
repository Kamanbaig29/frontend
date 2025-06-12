import React, { useEffect, useState } from 'react';
import {
  Box, Button, Paper, Typography, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  RadioGroup, FormControlLabel, Radio, TextField
} from '@mui/material';
import { useWebSocket } from '../context/webSocketContext';

interface WalletToken {
  _id: string;
  mint: string;
  amount: string;
  currentPrice: number;
  name: string;
  symbol: string;
  decimals: number;
  walletAddress: string;
}

export const ManualSellList: React.FC = () => {
  const [tokens, setTokens] = useState<WalletToken[]>([]);
  const { ws, status, error, sendMessage } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [privateKey, setPrivateKey] = useState<string>('');

  // Modal state
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedToken, setSelectedToken] = useState<WalletToken | null>(null);
  const [sellPercent, setSellPercent] = useState('10');

  useEffect(() => {
    if (status === 'connected') {
      sendMessage({ 
        type: 'GET_STATS',
        walletAddress: import.meta.env.VITE_BUYER_PUBLIC_KEY
      });
    }
  }, [status, sendMessage]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'STATS_DATA') {
          setTokens(data.data.walletTokens || []);
          setLoading(false);
        } else if (data.type === 'SELL_RESULT') {
          setStatusMessage(data.success ? 'Sell successful!' : `Sell failed: ${data.error}`);
          setTimeout(() => setStatusMessage(null), 4000);
          if (data.success) {
            sendMessage({
              type: 'GET_STATS',
              walletAddress: import.meta.env.VITE_BUYER_PUBLIC_KEY
            });
          }
        } else if (data.type === 'MANUAL_SELL_ERROR') {
          setStatusMessage(`Sell failed: ${data.error}`);
          setTimeout(() => setStatusMessage(null), 4000);
        }
      } catch (e) {
        console.error('Error parsing message:', e);
        setStatusMessage('Failed to parse WebSocket message');
        setLoading(false);
      }
    };

    ws.addEventListener('message', handleMessage);

    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws, sendMessage]);

  const openSellDialog = (token: WalletToken) => {
    setSelectedToken(token);
    setSellPercent('10');
    setPrivateKey('');
    setOpenDialog(true);
  };

  const handleConfirmSell = () => {
    if (!ws || !selectedToken || !privateKey) {
      setStatusMessage('Missing WebSocket connection, selected token, or private key.');
      return;
    }

    sendMessage({
      type: 'MANUAL_SELL',
      mint: selectedToken.mint,
      percent: Number(sellPercent),
      privateKey: privateKey,
      walletAddress: import.meta.env.VITE_BUYER_PUBLIC_KEY
    });
    setStatusMessage(`Sell request sent for ${sellPercent}% of ${selectedToken.symbol}`);
    setOpenDialog(false);
  };

  return (
    <Box mt={4}>
      <Typography variant="h5" color="white" gutterBottom>
        Your Tokens (Manual Sell List)
      </Typography>

      {loading && <CircularProgress />}
      {statusMessage && <Alert severity="info" sx={{ mb: 2 }}>{statusMessage}</Alert>}

      {!loading && !statusMessage && tokens.length === 0 && (
        <Typography color="white" sx={{ mt: 2 }}>
          No tokens found.
        </Typography>
      )}

      {!loading && !statusMessage && tokens.map((token) => (
        <Paper key={token._id} sx={{ p: 2, mb: 2, bgcolor: '#2a2a2a' }}>
          <Typography color="white">Name: {token.name || 'Unknown'}</Typography>
          <Typography color="white">Symbol: {token.symbol || '?'}</Typography>
          <Typography color="white">Mint: {token.mint}</Typography>
          <Typography color="gray">
            Balance: {(Number(token.amount) / Math.pow(10, token.decimals)).toFixed(4)}
          </Typography>
          <Button
            variant="contained"
            color="error"
            sx={{ mt: 1 }}
            onClick={() => openSellDialog(token)}
          >
            Sell
          </Button>
        </Paper>
      ))}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Sell Token</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            How much do you want to sell of {selectedToken?.symbol || 'token'}?
          </Typography>
          <RadioGroup
            value={sellPercent}
            onChange={(e) => setSellPercent(e.target.value)}
          >
            <FormControlLabel value="10" control={<Radio />} label="10%" />
            <FormControlLabel value="25" control={<Radio />} label="25%" />
            <FormControlLabel value="100" control={<Radio />} label="100%" />
          </RadioGroup>
          <TextField
            margin="dense"
            label="Your Private Key (bs58 or array)"
            type="password"
            fullWidth
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmSell}>Confirm Sell</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

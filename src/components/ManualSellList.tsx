import React, { useEffect, useState } from 'react';
import {
  Box, Button, Paper, Typography, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  RadioGroup, FormControlLabel, Radio
} from '@mui/material';

interface WalletToken {
  _id: string;
  mint: string;
  amount: string;
  currentPrice: number;
  name: string;
  symbol: string;
  decimals: number;
}

export const ManualSellList: React.FC = () => {
  const [tokens, setTokens] = useState<WalletToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // WebSocket ref for reuse in sell
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Modal state
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedToken, setSelectedToken] = useState<WalletToken | null>(null);
  const [sellPercent, setSellPercent] = useState('10');

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3001');
    setWs(socket);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'MANUAL_SELL' }));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'STATS_DATA') {
          setTokens(message.data.walletTokens || []);
          setLoading(false);
          setError(null);
        } else if (message.type === 'SELL_RESULT') {
          setStatusMessage(message.success ? 'Sell successful!' : `Sell failed: ${message.error}`);
          setTimeout(() => setStatusMessage(null), 4000);
          if (message.success) {
            // Optionally refresh tokens
            ws?.send(JSON.stringify({ type: 'MANUAL_SELL' }));
          }
        }
      } catch (e) {
        setError('Failed to parse WebSocket message');
        setLoading(false);
      }
    };

    socket.onerror = () => {
      setError('WebSocket error occurred');
      setLoading(false);
    };

    return () => {
      socket.close();
    };
  }, []);

  const openSellDialog = (token: WalletToken) => {
    setSelectedToken(token);
    setSellPercent('10');
    setOpenDialog(true);
  };

  const handleConfirmSell = () => {
    if (!ws || !selectedToken) return;
    ws.send(JSON.stringify({
      type: 'SELL_TOKEN',
      data: {
        mint: selectedToken.mint,
        percent: Number(sellPercent),
      }
    }));
    setStatusMessage(`Sell request sent for ${sellPercent}% of ${selectedToken.symbol}`);
    setOpenDialog(false);
  };

  return (
    <Box mt={4}>
      <Typography variant="h5" color="white" gutterBottom>
        Your Tokens (Manual Sell List)
      </Typography>

      {loading && <CircularProgress />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {statusMessage && <Alert severity="info" sx={{ mb: 2 }}>{statusMessage}</Alert>}

      {!loading && !error && tokens.length === 0 && (
        <Typography color="white" sx={{ mt: 2 }}>
          No tokens found.
        </Typography>
      )}

      {!loading && !error && tokens.map((token) => (
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmSell}>Confirm Sell</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

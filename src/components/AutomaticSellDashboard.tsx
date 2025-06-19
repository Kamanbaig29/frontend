import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, Typography, CircularProgress, Alert, FormControlLabel, Switch, TextField } from '@mui/material';
import { useWebSocket } from '../context/webSocketContext';

export const AutomaticSellDashboard: React.FC<{ onBackHome: () => void }> = ({ onBackHome }) => {
    const [tokens, setTokens] = useState<any[]>([]);
    const { ws, status, sendMessage } = useWebSocket();
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'connected') {
            sendMessage({ type: 'AUTO_SELL_CONNECT' });
            sendMessage({ type: 'GET_STATS', walletAddress: import.meta.env.VITE_BUYER_PUBLIC_KEY });
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
                } else if (data.type === 'AUTO_SELL_CONNECTED') {
                    setStatusMessage('Connected to Auto-Sell backend!');
                    setTimeout(() => setStatusMessage(null), 2000);
                }
            } catch (e) {
                setStatusMessage('Failed to parse WebSocket message');
                setLoading(false);
            }
        };
        ws.addEventListener('message', handleMessage);
        return () => ws.removeEventListener('message', handleMessage);
    }, [ws, sendMessage]);

    const handleAutoSellToggle = (id: string, checked: boolean) => {
        // Implement the logic to toggle auto-sell for a token
    };

    const handleTakeProfitChange = (id: string, value: string) => {
        // Implement the logic to change take profit percentage for a token
    };

    const handleStopLossChange = (id: string, value: string) => {
        // Implement the logic to change stop loss percentage for a token
    };

    const handleSaveSettings = (token: any) => {
        // Implement the logic to save settings for a token
    };

    return (
        <Box mt={4}>
            <div className="flex justify-between items-center mb-6" style={{ marginBottom: 20 }}>
                <Typography variant="h5" color="white" gutterBottom>
                    Automatic Sell Dashboard
                </Typography>
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
            {loading && <CircularProgress />}
            {statusMessage && <Alert severity="info" sx={{ mb: 2 }}>{statusMessage}</Alert>}
            {tokens && tokens.length > 0 ? (
                tokens.map((token) => (
                    <Paper key={token._id} sx={{ p: 2, mb: 2, bgcolor: '#2a2a2a' }}>
                        <Typography color="white">Name: {token.name || 'Unknown'}</Typography>
                        <Typography color="white">Symbol: {token.symbol || '?'}</Typography>
                        <Typography color="white">Mint: {token.mint}</Typography>
                        <Typography color="gray">
                            Balance: {(Number(token.amount) / Math.pow(10, token.decimals)).toFixed(4)}
                        </Typography>
                        <Typography color="gray">
                            Buy Price: {token.buyPrice ? Number(token.buyPrice).toFixed(9) : 'N/A'} SOL
                        </Typography>
                        <Typography color="gray">
                            Current Price: {token.currentPrice ? Number(token.currentPrice).toFixed(9) : '...'} SOL
                        </Typography>
                        <Typography color={token.profitLossPercent > 0 ? 'green' : 'red'}>
                            Profit/Loss: {token.profitLossPercent ? `${token.profitLossPercent.toFixed(2)}%` : '...'}
                        </Typography>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={token.autoSellEnabled}
                                    onChange={e => handleAutoSellToggle(token._id, e.target.checked)}
                                />
                            }
                            label="Auto-Sell"
                            sx={{ color: 'white' }}
                        />
                        <TextField
                            label="Take Profit %"
                            type="number"
                            value={token.takeProfitPercent}
                            onChange={e => handleTakeProfitChange(token._id, e.target.value)}
                            sx={{ mt: 1, mr: 2, width: 120 }}
                            InputProps={{ inputProps: { min: 1, max: 100, step: 1 } }}
                        />
                        <TextField
                            label="Stop Loss %"
                            type="number"
                            value={token.stopLossPercent}
                            onChange={e => handleStopLossChange(token._id, e.target.value)}
                            sx={{ mt: 1, width: 120 }}
                            InputProps={{ inputProps: { min: 1, max: 100, step: 1 } }}
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            sx={{ mt: 1, ml: 2 }}
                            onClick={() => handleSaveSettings(token)}
                        >
                            Save
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            sx={{ mt: 1, ml: 2 }}
                            // onClick={() => ...}
                        >
                            Sell
                        </Button>
                    </Paper>
                ))
            ) : (
                !loading && <Typography color="white" sx={{ mt: 2 }}>No tokens found.</Typography>
            )}
        </Box>
    );
};

import React, { useEffect, useState, useMemo } from 'react';
import { Box, Button, Paper, Typography, CircularProgress, Alert, FormControlLabel, Switch, TextField } from '@mui/material';
import { useWebSocket } from '../context/webSocketContext';
import SearchIcon from '@mui/icons-material/Search';
import { jwtDecode } from "jwt-decode";

function getCurrentUserId(): string | null {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const decoded: any = jwtDecode(token);
    return decoded.id || decoded.userId || decoded._id || null;
  } catch {
    return null;
  }
}

interface AutomaticSellDashboardProps {
  onBackHome: () => void;
}

export const AutomaticSellDashboard: React.FC<AutomaticSellDashboardProps> = ({ onBackHome }) => {
    const { ws, sendMessage, sellPresets, activeSellPreset } = useWebSocket();
    const [tokens, setTokens] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [tokenSettings, setTokenSettings] = useState<Record<string, any>>({});
    const [tokenPrices, setTokenPrices] = useState<any[]>([]);
    const [autoSellConfigs, setAutoSellConfigs] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const currentUserId = getCurrentUserId();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (ws && token) {
            ws.send(JSON.stringify({ type: 'AUTHENTICATE', token }));
            ws.send(JSON.stringify({ type: 'GET_USER_TOKENS' }));
        }
    }, [ws]);

    useEffect(() => {
        if (ws) ws.send(JSON.stringify({ type: 'GET_TOKEN_PRICES' }));
    }, [ws]);
    useEffect(() => {
        if (ws) ws.send(JSON.stringify({ type: 'GET_USER_AUTOSELL_CONFIGS' }));
    }, [ws]);

    useEffect(() => {
        if (tokens.length && autoSellConfigs.length) {
            const autoSellMap: Record<string, any> = {};
            autoSellConfigs.forEach((cfg: any) => {
                autoSellMap[`${cfg.mint}_${cfg.userPublicKey}`] = cfg;
            });
            const initialSettings: Record<string, any> = {};
            tokens.forEach((token: any) => {
                const cfg = autoSellMap[`${token.mint}_${token.userPublicKey}`] || {};
                initialSettings[token._id] = {
                    autoSellEnabled: cfg.autoSellEnabled ?? false,
                    takeProfitPercent: cfg.takeProfitPercent ?? '',
                    stopLossPercent: cfg.stopLossPercent ?? '',
                    sellPercentage: cfg.sellPercentage ?? '100',
                };
            });
            setTokenSettings(initialSettings);
        }
    }, [tokens, autoSellConfigs]);

    useEffect(() => {
        if (!ws) return;
        const handleMessage = (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.type === 'USER_TOKENS') {
                setTokens(data.tokens || []);
                setLoading(false);
            } else if (data.type === 'TOKEN_PRICES') {
                setTokenPrices(data.prices || []);
            } else if (data.type === 'USER_AUTOSELL_CONFIGS') {
                setAutoSellConfigs(data.configs || []);
            } else if (data.type === 'AUTO_SELL_SETTINGS_UPDATED') {
                setStatusMessage(data.message);
                setTimeout(() => setStatusMessage(null), 2000);
            }
        };
        ws.addEventListener('message', handleMessage);
        return () => ws.removeEventListener('message', handleMessage);
    }, [ws]);

    const handleSettingChange = (id: string, field: string, value: any) => {
        setTokenSettings(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const handleSaveSettings = (token: any) => {
        const settings = tokenSettings[token._id];
        if (ws && settings) {
            ws.send(JSON.stringify({
                type: 'UPDATE_AUTO_SELL_SETTINGS',
                payload: {
                    mint: token.mint,
                    userPublicKey: token.userPublicKey,
                    autoSellEnabled: settings.autoSellEnabled,
                    takeProfitPercent: settings.takeProfitPercent,
                    stopLossPercent: settings.stopLossPercent,
                    sellPercentage: settings.sellPercentage,
                }
            }));
        }
    };

    const handleManualSell = (token: any) => {
        if (!token || !token._id) {
            console.error('Invalid token:', token);
            return;
        }
        const settings = tokenSettings[token._id];
        if (ws && settings) {
            ws.send(JSON.stringify({
                type: 'MANUAL_SELL',
                mint: token.mint,
                percent: Number(settings?.sellPercentage || 100),
                walletAddress: token.userPublicKey,
                slippage: Number(sellPresets[activeSellPreset].slippage || 1),
                priorityFee: Number(sellPresets[activeSellPreset].priorityFee || 0.001),
                bribeAmount: Number(sellPresets[activeSellPreset].bribeAmount || 0)
            }));
        }
    };

    const filteredTokens = useMemo(() => {
        if (!search) return tokens;
        return tokens.filter(token =>
            (token.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (token.symbol || '').toLowerCase().includes(search.toLowerCase()) ||
            (token.mint || '').toLowerCase().includes(search.toLowerCase())
        );
    }, [tokens, search]);

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
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                <SearchIcon style={{ color: 'white', marginRight: 8 }} />
                <TextField
                    placeholder="Search by name, symbol, or mint"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    sx={{
                        width: 350,
                        input: { color: 'white' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'gray' }
                    }}
                    size="small"
                />
            </div>
            {loading && <CircularProgress />}
            {statusMessage && <Alert severity="info" sx={{ mb: 2 }}>{statusMessage}</Alert>}
            {filteredTokens.length > 0 ? (
                filteredTokens.map((token) => {
                    const priceObj = tokenPrices.find(
                        p => p.mint === token.mint && p.userPublicKey === token.userPublicKey
                    );
                    const currentPrice = priceObj?.currentPrice ?? null;
                    const lastUpdated = priceObj?.lastUpdated
                        ? new Date(priceObj.lastUpdated).toLocaleString()
                        : 'N/A';

                    let profitLoss = null;
                    if (token.buyPrice && currentPrice) {
                        profitLoss = ((currentPrice - token.buyPrice) / token.buyPrice) * 100;
                    }

                    return (
                        <Paper key={token._id} sx={{ p: 2, mb: 2, bgcolor: '#2a2a2a' }}>
                            <Typography color="white">Name: {token.name || 'Unknown'}</Typography>
                            <Typography color="white">Symbol: {token.symbol || '?'}</Typography>
                            <Typography color="white">Mint: {token.mint}</Typography>
                            <Typography color="gray">
                                Balance: {token.amount && token.decimals ? (Number(token.amount) / Math.pow(10, token.decimals)).toFixed(4) : 'N/A'}
                            </Typography>
                            <Typography color="gray">
                                Buy Price: {token.buyPrice ? Number(token.buyPrice).toFixed(9) : 'N/A'} SOL
                            </Typography>
                            <Typography color="gray">
                                Current Price: {currentPrice !== null ? Number(currentPrice).toFixed(9) : '...'} SOL
                            </Typography>
                            <Typography color="gray">
                                Last Updated: {lastUpdated}
                            </Typography>
                            <Typography color={profitLoss !== null ? (profitLoss > 0 ? 'green' : 'red') : 'gray'}>
                                Profit/Loss: {profitLoss !== null ? `${profitLoss.toFixed(2)}%` : '...'}
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={tokenSettings[token._id]?.autoSellEnabled ?? false}
                                        onChange={e => handleSettingChange(token._id, 'autoSellEnabled', e.target.checked)}
                                    />
                                }
                                label="Auto-Sell"
                                sx={{ color: 'white' }}
                            />
                            <TextField
                                label="Take Profit %"
                                type="number"
                                value={tokenSettings[token._id]?.takeProfitPercent ?? ''}
                                onChange={e => handleSettingChange(token._id, 'takeProfitPercent', e.target.value)}
                                sx={{
                                    mt: 1, mr: 2, width: 120,
                                    '& .MuiInputLabel-root': { color: 'white' },
                                    '& .MuiInputBase-input': { color: 'white' },
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'gray' }
                                }}
                                InputProps={{ inputProps: { min: 1, step: 1 } }}
                            />
                            <TextField
                                label="Stop Loss %"
                                type="number"
                                value={tokenSettings[token._id]?.stopLossPercent ?? ''}
                                onChange={e => handleSettingChange(token._id, 'stopLossPercent', e.target.value)}
                                sx={{
                                    mt: 1, mr: 2, width: 120,
                                    '& .MuiInputLabel-root': { color: 'white' },
                                    '& .MuiInputBase-input': { color: 'white' },
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'gray' }
                                }}
                                InputProps={{ inputProps: { min: 1, step: 1 } }}
                            />
                            <TextField
                                label="Sell %"
                                type="number"
                                value={tokenSettings[token._id]?.sellPercentage ?? ''}
                                onChange={e => handleSettingChange(token._id, 'sellPercentage', e.target.value)}
                                sx={{
                                    mt: 1, mr: 2, width: 120,
                                    '& .MuiInputLabel-root': { color: 'white' },
                                    '& .MuiInputBase-input': { color: 'white' },
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'gray' }
                                }}
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
                                onClick={() => handleManualSell(token)}
                            >
                                Sell
                            </Button>
                        </Paper>
                    );
                })
            ) : (
                !loading && <Typography color="white" sx={{ mt: 2 }}>No tokens found.</Typography>
            )}
        </Box>
    );
};
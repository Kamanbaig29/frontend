import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Box, Button, Paper, Typography, CircularProgress, Alert, FormControlLabel, Switch, TextField } from '@mui/material';
import { useWebSocket } from '../context/webSocketContext';
import SearchIcon from '@mui/icons-material/Search';


export const AutomaticSellDashboard: React.FC<{ onBackHome: () => void }> = ({ onBackHome }) => {
    const { ws, status, sendMessage } = useWebSocket();
    const [allTokens, setAllTokens] = useState<any[]>([]);
    const [tokens, setTokens] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [tokenSettings, setTokenSettings] = useState<Record<string, any>>({});
    const [isInitialized, setIsInitialized] = useState(false);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const statsRequested = useRef(false);
    const [statsData, setStatsData] = useState<{ totalTokens: number, pageSize: number } | null>(null);
    const pageSize = 10; // ya jitna aap chahen


    useEffect(() => {
        if (status === 'connected' && !statsRequested.current) {
            sendMessage({ type: 'AUTO_SELL_CONNECT' });
            statsRequested.current = true;
        }
    }, [status, sendMessage]);

    useEffect(() => {
        if (!ws) return;
        if (search.trim().length === 0) {
            setIsSearching(false);
            sendMessage({ type: 'AUTO_SELL_CONNECT', page });
        } else {
            setIsSearching(true);
            const timeout = setTimeout(() => {
                sendMessage({ type: 'SEARCH_STATS', query: search.trim() });
            }, 400);
            return () => clearTimeout(timeout);
        }
    }, [search, ws, page, sendMessage]);

    useEffect(() => {
        if (search.trim().length > 0) setPage(1);
    }, [search]);

    useEffect(() => {
        if (ws && status === 'connected') {
            sendMessage({ type: 'GET_ALL_TOKENS' });
        }
    }, [ws, status, sendMessage]);

    useEffect(() => {
        if (!ws) return;
        const handleMessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'ALL_TOKENS') {
                    setAllTokens(data.tokens || []);
                    setLoading(false);
                } else if (data.type === 'TOKEN_UPDATE') {
                    setAllTokens(prev =>
                        prev.map(t => t.mint === data.token.mint ? { ...t, ...data.token } : t)
                    );
                } else if (data.type === 'SEARCH_RESULTS') {
                    setTokens(data.data.walletTokens || []);
                    setIsSearching(true);
                    setLoading(false);

                    // AutoSell configs ko bhi update karein
                    const autoSellMap: Record<string, any> = {};
                    const autoSellConfigs = data.data.autoSellConfigs || [];
                    autoSellConfigs.forEach((cfg: any) => {
                        autoSellMap[`${cfg.mint}_${cfg.userPublicKey}`] = cfg;
                    });
                    const initialSettings: Record<string, any> = {};
                    (data.data.walletTokens || []).forEach((token: any) => {
                        const cfg = autoSellMap[`${token.mint}_${token.userPublicKey}`] || {};
                        initialSettings[token._id] = {
                            autoSellEnabled: cfg.autoSellEnabled ?? false,
                            takeProfitPercent: cfg.takeProfitPercent ?? '',
                            stopLossPercent: cfg.stopLossPercent ?? '',
                            sellPercentage: cfg.sellPercentage ?? '100',
                            slippage: cfg.slippage ?? '5',
                            priorityFee: cfg.priorityFee ?? '0.001',
                            bribeAmount: cfg.bribeAmount ?? '0'
                        };
                    });
                    setTokenSettings(initialSettings);
                } else if (data.type === 'STATS_DATA') {
                    const walletTokens = data.data.walletTokens || [];
                    setTokens(walletTokens);
                    setStatsData({
                        totalTokens: data.data.totalTokens,
                        pageSize: data.data.pageSize
                    });

                    // Only set the form settings ONCE or if tokens/configs change
                    if (
                        !isInitialized
                    ) {
                        const t0 = performance.now();
                        const autoSellMap: Record<string, any> = {};
                        const autoSellConfigs = data.data.autoSellConfigs || [];
                        autoSellConfigs.forEach((cfg: any) => {
                            autoSellMap[`${cfg.mint}_${cfg.userPublicKey}`] = cfg;
                        });
                        const initialSettings: Record<string, any> = {};
                        walletTokens.forEach((token: any) => {
                            const cfg = autoSellMap[`${token.mint}_${token.userPublicKey}`] || {};
                            initialSettings[token._id] = {
                                autoSellEnabled: cfg.autoSellEnabled ?? false,
                                takeProfitPercent: cfg.takeProfitPercent ?? '',
                                stopLossPercent: cfg.stopLossPercent ?? '',
                                sellPercentage: cfg.sellPercentage ?? '100',
                                slippage: cfg.slippage ?? '5',
                                priorityFee: cfg.priorityFee ?? '0.001',
                                bribeAmount: cfg.bribeAmount ?? '0'
                            };
                        });
                        setTokenSettings(initialSettings);
                        setIsInitialized(true);
                        const t1 = performance.now();
                        console.log(`[STATS_DATA] Merging and setTokenSettings took ${t1 - t0} ms`);
                    }
                    setLoading(false);
                } else if (data.type === 'AUTO_SELL_CONNECTED') {
                    setStatusMessage('Connected to Auto-Sell backend!');
                    setTimeout(() => setStatusMessage(null), 2000);
                } else if (data.type === 'AUTO_SELL_SETTINGS_UPDATED') {
                    setStatusMessage(data.message);
                    setTimeout(() => setStatusMessage(null), 2000);
                } else if (data.type === 'PRICE_UPDATE') {
                    setTokens(prevTokens => {
                        let changed = false;
                        const updated = prevTokens.map(token => {
                            const priceObj = data.prices.find((p: any) => p.mint === token.mint);
                            if (priceObj && token.currentPrice !== priceObj.currentPrice) {
                                changed = true;
                                return {
                                    ...token,
                                    currentPrice: priceObj.currentPrice,
                                    lastUpdated: priceObj.lastUpdated
                                };
                            }
                            return token;
                        });
                        return changed ? updated : prevTokens;
                    });
                }
            } catch (e) {
                setStatusMessage('Failed to parse WebSocket message');
                setLoading(false);
            }
        };
        ws.addEventListener('message', handleMessage);
        return () => ws.removeEventListener('message', handleMessage);
    }, [ws, isInitialized, tokenSettings]);

    const handleSettingChange = (id: string, field: string, value: any) => {
        setTokenSettings(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
        console.log(`[handleSettingChange] Updated ${field} for token ${id}`);
    };

    const handleSaveSettings = (token: any) => {
        const settings = tokenSettings[token._id];
        if (settings) {
            console.log('[handleSaveSettings] Saving settings for', token.mint, settings);
            sendMessage({
                type: 'UPDATE_AUTO_SELL_SETTINGS',
                payload: {
                    mint: token.mint,
                    userPublicKey: token.userPublicKey,
                    buyPrice: token.buyPrice,
                    autoSellEnabled: settings.autoSellEnabled,
                    takeProfitPercent: settings.takeProfitPercent,
                    stopLossPercent: settings.stopLossPercent,
                    sellPercentage: settings.sellPercentage,
                    slippage: settings.slippage,
                    priorityFee: settings.priorityFee,
                    bribeAmount: settings.bribeAmount
                }
            });
        }
    };

    useEffect(() => {
        if (status === 'connected') {
            sendMessage({ type: 'AUTO_SELL_CONNECT', page });
        }
    }, [status, page, sendMessage]);

    // Search
    const filteredTokens = useMemo(() => {
        if (!search) return allTokens;
        return allTokens.filter(token =>
            (token.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (token.symbol || '').toLowerCase().includes(search.toLowerCase()) ||
            (token.mint || '').toLowerCase().includes(search.toLowerCase())
        );
    }, [allTokens, search]);

    // Pagination
    const paginatedTokens = useMemo(() => {
        return filteredTokens.slice((page - 1) * pageSize, page * pageSize);
    }, [filteredTokens, page, pageSize]);

    const totalPages = Math.ceil(filteredTokens.length / pageSize);

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
            {paginatedTokens.length > 0 ? (
                paginatedTokens.map((token) => (
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
                        <Typography color="gray">
                            Last Updated:{" "}
                            {token.lastUpdated
                                ? new Date(token.lastUpdated).toLocaleString()
                                : 'N/A'}
                        </Typography>
                        <Typography color={token.profitLossPercent > 0 ? 'green' : 'red'}>
                            Profit/Loss: {token.profitLossPercent ? `${token.profitLossPercent.toFixed(2)}%` : '...'}
                        </Typography>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={tokenSettings[token._id]?.autoSellEnabled || false}
                                    onChange={e => handleSettingChange(token._id, 'autoSellEnabled', e.target.checked)}
                                />
                            }
                            label="Auto-Sell"
                            sx={{ color: 'white' }}
                        />
                        <TextField
                            label="Take Profit %"
                            type="number"
                            value={tokenSettings[token._id]?.takeProfitPercent || ''}
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
                            value={tokenSettings[token._id]?.stopLossPercent || ''}
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
                            value={tokenSettings[token._id]?.sellPercentage || ''}
                            onChange={e => handleSettingChange(token._id, 'sellPercentage', e.target.value)}
                            sx={{
                                mt: 1, mr: 2, width: 120,
                                '& .MuiInputLabel-root': { color: 'white' },
                                '& .MuiInputBase-input': { color: 'white' },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'gray' }
                            }}
                            InputProps={{ inputProps: { min: 1, max: 100, step: 1 } }}
                        />
                        <TextField
                            label="Slippage %"
                            type="number"
                            value={tokenSettings[token._id]?.slippage || ''}
                            onChange={e => handleSettingChange(token._id, 'slippage', e.target.value)}
                            sx={{
                                mt: 1, mr: 2, width: 120,
                                '& .MuiInputLabel-root': { color: 'white' },
                                '& .MuiInputBase-input': { color: 'white' },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'gray' }
                            }}
                            InputProps={{ inputProps: { min: 0, max: 100, step: 0.1 } }}
                        />
                        <TextField
                            label="Priority Fee (SOL)"
                            type="number"
                            value={tokenSettings[token._id]?.priorityFee || ''}
                            onChange={e => handleSettingChange(token._id, 'priorityFee', e.target.value)}
                            sx={{
                                mt: 1, mr: 2, width: 150,
                                '& .MuiInputLabel-root': { color: 'white' },
                                '& .MuiInputBase-input': { color: 'white' },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'gray' }
                            }}
                            InputProps={{ inputProps: { min: 0, step: 0.0001 } }}
                        />
                        <TextField
                            label="Bribe Amount (SOL)"
                            type="number"
                            value={tokenSettings[token._id]?.bribeAmount || ''}
                            onChange={e => handleSettingChange(token._id, 'bribeAmount', e.target.value)}
                            sx={{
                                mt: 1, mr: 2, width: 150,
                                '& .MuiInputLabel-root': { color: 'white' },
                                '& .MuiInputBase-input': { color: 'white' },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'gray' }
                            }}
                            InputProps={{ inputProps: { min: 0, step: 0.0001 } }}
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
                            onClick={() => {
                                const settings = tokenSettings[token._id];
                                // Prompt user for private key (for demo, replace with your logic)
                                const privateKey = prompt("Enter your private key for this wallet (in JSON array or base58):");
                                if (!privateKey) {
                                    alert("Private key is required for manual sell.");
                                    return;
                                }
                                sendMessage({
                                    type: 'MANUAL_SELL',
                                    mint: token.mint,
                                    percent: Number(settings?.sellPercentage || 100),
                                    privateKey,
                                    walletAddress: token.userPublicKey,
                                    slippage: Number(settings?.slippage || 1),
                                    priorityFee: Number(settings?.priorityFee || 0.001),
                                    bribeAmount: Number(settings?.bribeAmount || 0)
                                });
                            }}
                        >
                            Sell
                        </Button>
                    </Paper>
                ))
            ) : (
                !loading && <Typography color="white" sx={{ mt: 2 }}>No tokens found.</Typography>
            )}
            {/* Pagination */}
            {filteredTokens.length > pageSize && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                    <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} variant="contained" sx={{ mr: 1 }}>
                        Previous
                    </Button>
                    <Typography sx={{ color: 'white', alignSelf: 'center', mx: 2 }}>
                        Page {page} of {totalPages}
                    </Typography>
                    <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} variant="contained">
                        Next
                    </Button>
                </div>
            )}
        </Box>
    );
};
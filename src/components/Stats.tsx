import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  CircularProgress
} from '@mui/material';
import { formatDistance } from 'date-fns';

interface StatsProps {
  onBackHome: () => void;
}

interface WalletToken {
  _id: string;
  mint: string;
  amount: string;
  currentPrice: number;
  name: string;
  symbol: string;
  decimals: number;
}

export const Stats: React.FC<StatsProps> = ({ onBackHome }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState({
    autoTokenBuys: [],
    walletTokens: [],
    tokenPrices: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'GET_STATS' }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'STATS_DATA') {
        setData(data.data);
        setLoading(false);
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection error. Please check backend.');
      setLoading(false);
    };

    ws.onclose = () => {
      setError('WebSocket connection closed. Please check backend.');
      setLoading(false);
    };

    return () => ws.close();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <Typography variant="h4" component="h1">
          Token Statistics
        </Typography>
        <Button 
          onClick={onBackHome}
          variant="contained" 
          sx={{ bgcolor: '#483D8B', '&:hover': { bgcolor: '#372B7A' } }}
        >
          Back to Home
        </Button>
      </div>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Auto Buys" />
          <Tab label="Wallet Tokens" />
          <Tab label="Token Prices" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Mint</TableCell>
                <TableCell>Buy Time</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Transaction</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.autoTokenBuys.map((token: any) => (
                <TableRow key={token._id}>
                  <TableCell>{token.mint.slice(0, 8)}...</TableCell>
                  <TableCell>
                    {formatDistance(new Date(token.buyTimestamp), new Date(), { addSuffix: true })}
                  </TableCell>
                  <TableCell>{token.status}</TableCell>
                  <TableCell>{token.transactionSignature.slice(0, 8)}...</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Token</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Current Price (SOL)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.walletTokens.map((token: WalletToken) => (
                <TableRow key={token._id}>
                  <TableCell>
                    {token.name || token.mint.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{token.symbol}</TableCell>
                  <TableCell>
                    {Number(token.amount) / Math.pow(10, token.decimals)}
                  </TableCell>
                  <TableCell>
                    {token.currentPrice.toFixed(6)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {activeTab === 2 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Mint</TableCell>
                <TableCell>Current Price (SOL)</TableCell>
                <TableCell>Last Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.tokenPrices || []).map((price: any) => (
                <TableRow key={price._id}>
                  <TableCell>{price.mint.slice(0, 8)}...</TableCell>
                  <TableCell>{price.currentPrice}</TableCell>
                  <TableCell>{new Date(price.lastUpdated).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
};
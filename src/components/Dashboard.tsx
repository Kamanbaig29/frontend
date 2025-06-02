import React, { useEffect, useState } from 'react';
import { useBot } from '../context/BotContext';
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
} from '@mui/material';

// Add props type for Dashboard
interface DashboardProps {
  onBackHome: () => void;
}

// Add this type for status colors
type StatusColor = 'success' | 'warning' | 'error' | 'default';

// Add this function before the Dashboard component
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
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    // Send mode selection when dashboard mounts
    const ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'SET_MODE',
        mode: 'automatic'
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'BOT_STATUS') {
        setStatus(data.status);
      }
      if (data.type === 'NEW_TOKEN') {
        dispatch({ type: 'ADD_TOKEN', payload: { ...data.tokenData } });
      }
    };

    return () => ws.close();
  }, [dispatch]);

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Automatic Trading Dashboard</h1>
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
              <TableCell>Status</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Mint Address</TableCell>
              <TableCell>Creator</TableCell>
              <TableCell>Supply</TableCell>
              <TableCell>Bonding Curve</TableCell>
              <TableCell>Curve Token</TableCell>
              <TableCell>User Token</TableCell>
              <TableCell>Metadata</TableCell>
              <TableCell>Decimals</TableCell>
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
                <TableCell>
                  <Chip
                    label={token.status}
                    color={getStatusColor(token.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {new Date(token.timestamp).toLocaleTimeString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.mint.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.creator.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-white">{token.supply || 'Unknown'}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.bondingCurve.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.curveTokenAccount.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.userTokenAccount.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">{token.metadata.slice(0, 8)}...</span>
                  </div>
                </TableCell>
                <TableCell>{token.decimals}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};
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
} from '@mui/material';

interface DashboardProps {
  onBackHome: () => void;
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

  useEffect(() => {
    if (ws && wsStatus === 'connected') {
      sendMessage({
        type: 'SET_MODE',
        mode: 'automatic'
      });

      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.type === 'BOT_STATUS') {
          setStatus(data.status);
        }
        if (data.type === 'NEW_TOKEN') {
          dispatch({
            type: 'ADD_TOKEN',
            payload: {
              ...data.tokenData,
              timestamp: Date.now(),
            }
          });
        }
        if (data.type === 'BUY_SUCCESS') {
          dispatch({
            type: 'UPDATE_TOKEN_STATS',
            payload: {
              mint: data.tokenData.mint,
              status: 'bought',
              transactionSignature: data.tokenData.transactionSignature,
              executionTimeMs: data.tokenData.executionTimeMs
            }
          });
          setStatus(`Bot bought ${data.tokenData.mint.slice(0, 8)}... in ${data.tokenData.executionTimeMs}ms`);
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

  return (
    <div className="container mx-auto p-4">
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
};
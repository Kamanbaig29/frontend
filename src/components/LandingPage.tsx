// Add this at the top of the file, before the imports
declare global {
  interface Window {
    ws?: WebSocket;
  }
}

import React, { useState, useEffect } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import AutoModeIcon from '@mui/icons-material/AutoMode';
//import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import SellIcon from '@mui/icons-material/Sell';
//import SettingsIcon from '@mui/icons-material/Settings';
//import PresetModal from './PresetModal';
import { useWebSocket } from '../context/webSocketContext';

interface LandingPageProps {
  onBuyClick: () => void;
  onSellClick: () => void;
  onViewStats: () => void;
  onViewTokenList: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onBuyClick, onSellClick, onViewStats, onViewTokenList }) => {
  //const [openPresetModal, setOpenPresetModal] = useState(false);
  const {
    //buyPresets, sellPresets,
    activeBuyPreset, activeSellPreset,
    //setActiveBuyPreset, setActiveSellPreset,
    ws
  } = useWebSocket();

  const applyPreset = (mode: 'buy' | 'sell', presetIndex: number) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: "APPLY_PRESET",
        mode,
        presetIndex
      }));
    }
  };

  return (
    <Box 
      sx={{ 
        height: '100vh', 
        width: '100vw',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: '#1a1a1a',
        position: 'relative'
      }}
    >
      <Paper 
        sx={{ 
          p: 4, 
          bgcolor: '#6A5ACD',
          borderRadius: 2,
          boxShadow: 3,
          width: '80%',
          maxWidth: 600
        }}
      >
        <Typography 
          variant="h4" 
          sx={{ 
            color: 'white', 
            textAlign: 'center', 
            mb: 4,
            fontWeight: 'bold'
          }}
        >
          Token Sniper Bot
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 3, flexDirection: 'column', alignItems: 'center' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<AutoModeIcon />}
            onClick={() => { onBuyClick(); applyPreset('buy', activeBuyPreset); }}
            sx={{
              bgcolor: '#4CAF50',
              '&:hover': { bgcolor: '#45a049' },
              py: 2,
              px: 4,
              fontSize: '1.1rem',
              width: '100%'
            }}
          >
            Buy
          </Button>
          
          <Button
            variant="contained"
            size="large"
            startIcon={<SellIcon />}
            onClick={() => { onSellClick(); applyPreset('sell', activeSellPreset); }}
            sx={{
              bgcolor: '#f44336',
              '&:hover': { bgcolor: '#e53935' },
              py: 2,
              px: 4,
              fontSize: '1.1rem',
              width: '100%'
            }}
          >
            Sell
          </Button>
        </Box>
        <Button
          onClick={onViewTokenList}
          className="w-64 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          View All Tokens
        </Button>
        <Button
          onClick={onViewStats}
          className="w-64 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          View Statistics
        </Button>
      </Paper>
    </Box>
  );
};

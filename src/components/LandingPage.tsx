// Add this at the top of the file, before the imports
declare global {
  interface Window {
    ws?: WebSocket;
  }
}

import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import SellIcon from '@mui/icons-material/Sell';

interface LandingPageProps {
  onBuyClick: () => void;
  onSellClick: () => void;
  onViewStats: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onBuyClick, onSellClick, onViewStats }) => {
  return (
    <Box 
      sx={{ 
        height: '100vh', 
        width: '100vw',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: '#1a1a1a' 
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
            onClick={onBuyClick}
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
            onClick={onSellClick}
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
          variant="outlined"
          onClick={onViewStats}
          sx={{ borderColor: '#483D8B', color: '#483D8B', '&:hover': { borderColor: '#372B7A', bgcolor: 'rgba(72, 61, 139, 0.1)' } }}
        >
          View Wallet Stats
        </Button>
      </Paper>
    </Box>
  );
};

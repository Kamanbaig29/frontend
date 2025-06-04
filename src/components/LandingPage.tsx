import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import SellIcon from '@mui/icons-material/Sell';

interface LandingPageProps {
  onSelectMode: (mode: 'manual' | 'automatic') => void;
  onViewStats: () => void;
  onManualSell: () => void;
  onAutomaticSell: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectMode,
  onViewStats,
  onManualSell,
  onAutomaticSell
}) => {
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
            onClick={() => onSelectMode('automatic')}
            sx={{
              bgcolor: '#483D8B',
              '&:hover': { bgcolor: '#372B7A' },
              py: 2,
              px: 4,
              fontSize: '1.1rem',
              width: '100%'
            }}
          >
            Automatic Trading
          </Button>
          
          <Button
            variant="contained"
            size="large"
            startIcon={<ManageSearchIcon />}
            onClick={() => onSelectMode('manual')}
            sx={{
              bgcolor: '#483D8B',
              '&:hover': { bgcolor: '#372B7A' },
              py: 2,
              px: 4,
              fontSize: '1.1rem',
              width: '100%'
            }}
          >
            Manual Trading
          </Button>

          <Button
            variant="contained"
            size="large"
            startIcon={<SellIcon />}
            onClick={onManualSell}
            sx={{
              bgcolor: '#FF8C00',
              '&:hover': { bgcolor: '#FF7F50' },
              py: 2,
              px: 4,
              fontSize: '1.1rem',
              width: '100%'
            }}
          >
            Manual Sell
          </Button>

          <Button
            variant="contained"
            size="large"
            startIcon={<SellIcon />}
            onClick={onAutomaticSell}
            sx={{
              bgcolor: '#CD5C5C',
              '&:hover': { bgcolor: '#B22222' },
              py: 2,
              px: 4,
              fontSize: '1.1rem',
              width: '100%'
            }}
          >
            Automatic Sell
          </Button>

          <Button
            variant="contained"
            size="large"
            onClick={onViewStats}
            sx={{
              bgcolor: '#3CB371',
              '&:hover': { bgcolor: '#2E8B57' },
              py: 2,
              px: 4,
              fontSize: '1.1rem',
              width: '100%'
            }}
          >
            View Statistics
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

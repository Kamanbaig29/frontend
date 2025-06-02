import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';

interface LandingPageProps {
  onSelectMode: (mode: 'manual' | 'automatic') => void;
}

export const LandingPage = ({ onSelectMode }: LandingPageProps) => {
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
        
        <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
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
              fontSize: '1.1rem'
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
              fontSize: '1.1rem'
            }}
          >
            Manual Trading
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};
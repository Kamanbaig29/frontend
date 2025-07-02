// Add this at the top of the file, before the imports
declare global {
  interface Window {
    ws?: WebSocket;
  }
}

import React, { useState, useEffect } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import SellIcon from '@mui/icons-material/Sell';
import SettingsIcon from '@mui/icons-material/Settings';
import PresetModal from './PresetModal';
import { useWebSocket } from '../context/webSocketContext';

interface LandingPageProps {
  onBuyClick: () => void;
  onSellClick: () => void;
  onViewStats: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onBuyClick, onSellClick, onViewStats }) => {
  const [openPresetModal, setOpenPresetModal] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);
  const [activePreset, setActivePreset] = useState<number>(0);
  const [buyPresets, setBuyPresets] = useState<any[]>([]);
  const [sellPresets, setSellPresets] = useState<any[]>([]);
  const [activeBuyPreset, setActiveBuyPreset] = useState<number>(0);
  const [activeSellPreset, setActiveSellPreset] = useState<number>(0);
  const { ws, isAuthenticated } = useWebSocket();

  useEffect(() => {
    console.log("LandingPage useEffect: ws", ws, "isAuthenticated", isAuthenticated);
    if (ws && isAuthenticated) {
      if (ws.readyState === 1) {
        console.log("Sending GET_PRESETS");
        ws.send(JSON.stringify({ type: "GET_PRESETS" }));
      } else {
        ws.addEventListener("open", () => {
          console.log("WebSocket opened, sending GET_PRESETS");
          ws.send(JSON.stringify({ type: "GET_PRESETS" }));
        }, { once: true });
      }

      const handleMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);

        if (
          data.type === "AUTH_ERROR" ||
          (data.type === "ERROR" && data.error && data.error.toLowerCase().includes("token"))
        ) {
          localStorage.removeItem("token");
          window.location.href = "/"; // or your login route
          return;
        }

        if (data.type === "PRESETS") {
          setBuyPresets(data.buyPresets);
          setSellPresets(data.sellPresets);
          setActiveBuyPreset(data.activeBuyPreset);
          setActiveSellPreset(data.activeSellPreset);
        }
        if (data.type === "ACTIVE_PRESET_UPDATED") {
           console.log("ACTIVE_PRESET_UPDATED", data);
          if (data.mode?.toLowerCase() === "buy") setActiveBuyPreset(data.presetIndex);
          else if (data.mode?.toLowerCase() === "sell") setActiveSellPreset(data.presetIndex);
        }
        if (data.type === "PRESET_UPDATED") {
          if (data.mode === "buy") {
            setBuyPresets((prev) => {
              const updated = [...prev];
              updated[data.presetIndex] = { ...updated[data.presetIndex], ...data.settings };
              return updated;
            });
          } else {
            setSellPresets((prev) => {
              const updated = [...prev];
              updated[data.presetIndex] = { ...updated[data.presetIndex], ...data.settings };
              return updated;
            });
          }
        }
      };

      ws.addEventListener("message", handleMessage);

      // Cleanup on unmount
      return () => {
        ws.removeEventListener("message", handleMessage);
      };
    }
  }, [ws, isAuthenticated]);

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
      {/* Settings Icon */}
      <Button
        sx={{ position: 'absolute', top: 24, right: 32, minWidth: 0, p: 1, bgcolor: '#fff2', borderRadius: '50%' }}
        onClick={() => setOpenPresetModal(true)}
      >
        <SettingsIcon sx={{ color: 'white', fontSize: 32 }} />
      </Button>

      {/* Preset Modal */}
      <PresetModal
        open={openPresetModal}
        onClose={() => setOpenPresetModal(false)}
        buyPresets={buyPresets}
        sellPresets={sellPresets}
        activeBuyPreset={activeBuyPreset}
        activeSellPreset={activeSellPreset}
        setActiveBuyPreset={setActiveBuyPreset}
        setActiveSellPreset={setActiveSellPreset}
        setBuyPresets={setBuyPresets}
        setSellPresets={setSellPresets}
        // ws prop agar chahiye to
      />

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
        {/*<Button
          variant="outlined"
          onClick={onViewStats}
          sx={{ borderColor: '#483D8B', color: '#483D8B', '&:hover': { borderColor: '#372B7A', bgcolor: 'rgba(72, 61, 139, 0.1)' } }}
        >
          View Wallet Stats
        </Button>*/}
      </Paper>
    </Box>
  );
};

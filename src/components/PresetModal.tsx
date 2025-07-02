import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  ToggleButtonGroup, ToggleButton, Box, Typography, TextField, MenuItem, Checkbox, FormControlLabel
} from '@mui/material';
import { useWebSocket } from '../context/webSocketContext';

interface PresetModalProps {
  open: boolean;
  onClose: () => void;
  buyPresets: any[];
  sellPresets: any[];
  activeBuyPreset: number;
  activeSellPreset: number;
  setActiveBuyPreset: (idx: number) => void;
  setActiveSellPreset: (idx: number) => void;
  setBuyPresets: (presets: any[]) => void;
  setSellPresets: (presets: any[]) => void;
}

const mevModes = [
  { value: "off", label: "Off" },
  { value: "reduced", label: "Reduced" },
  { value: "secure", label: "Secure" }
];

const PresetModal: React.FC<PresetModalProps> = ({
  open, onClose, buyPresets, sellPresets, activeBuyPreset, activeSellPreset,
  setActiveBuyPreset, setActiveSellPreset, setBuyPresets, setSellPresets
}) => {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [form, setForm] = useState<any>({});
  const { ws } = useWebSocket();

  // Update form when preset or mode changes
  useEffect(() => {
    if (mode === 'buy' && buyPresets && buyPresets[activeBuyPreset]) {
      console.log("Setting form from buyPresets:", buyPresets[activeBuyPreset]);
      setForm({ ...buyPresets[activeBuyPreset] });
    }
    if (mode === 'sell' && sellPresets && sellPresets[activeSellPreset]) {
      console.log("Setting form from sellPresets:", sellPresets[activeSellPreset]);
      setForm({ ...sellPresets[activeSellPreset] });
    }
  }, [mode, activeBuyPreset, activeSellPreset, buyPresets, sellPresets]);

  const handlePresetChange = (event: React.MouseEvent<HTMLElement>, newPreset: number) => {
    if (newPreset !== null) {
      if (mode === 'buy') setActiveBuyPreset(newPreset);
      else setActiveSellPreset(newPreset);
      if (ws) ws.send(JSON.stringify({ type: "APPLY_PRESET", mode, presetIndex: newPreset }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    const newForm = {
      ...form,
      [name]: type === "checkbox" ? checked : value
    };
    setForm(newForm);

    // Auto-save to backend (send full form)
    if (ws) {
      ws.send(JSON.stringify({
        type: "UPDATE_PRESET",
        mode,
        presetIndex: mode === 'buy' ? activeBuyPreset : activeSellPreset,
        settings: newForm
      }));
    }
  };

  const handleMevModeChange = (_event: React.MouseEvent<HTMLElement>, value: string) => {
    if (!value) return;
    setForm((prev: any) => ({
      ...prev,
      mevMode: value
    }));
    if (ws) {
      ws.send(JSON.stringify({
        type: "UPDATE_PRESET",
        mode,
        presetIndex: mode === 'buy' ? activeBuyPreset : activeSellPreset,
        settings: { ...form, mevMode: value }
      }));
    }
  };

  const handleSave = () => {
    // Update local state
    const updatedPresets = { buyPresets, sellPresets };
    if (mode === 'buy') {
      updatedPresets.buyPresets = [...buyPresets];
      updatedPresets.buyPresets[activeBuyPreset] = { ...form };
    } else {
      updatedPresets.sellPresets = [...sellPresets];
      updatedPresets.sellPresets[activeSellPreset] = { ...form };
    }
    setBuyPresets(updatedPresets.buyPresets);
    setSellPresets(updatedPresets.sellPresets);

    // Send update to backend
    if (ws) {
      ws.send(JSON.stringify({
        type: "UPDATE_PRESET",
        mode,
        presetIndex: mode === 'buy' ? activeBuyPreset : activeSellPreset,
        settings: form
      }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value } = target;
    const defaultFields = ["buyAmount", "priorityFee", "bribeAmount", "maxFee"];
    if (defaultFields.includes(name) && (!value || value.trim() === "")) {
      const newForm = { ...form, [name]: "0.001" };
      setForm(newForm);
      if (ws) {
        ws.send(JSON.stringify({
          type: "UPDATE_PRESET",
          mode,
          presetIndex: mode === 'buy' ? activeBuyPreset : activeSellPreset,
          settings: newForm
        }));
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: "#181A20", color: "#fff" }}>Trading Presets</DialogTitle>
      <DialogContent sx={{ bgcolor: "#181A20", color: "#fff" }}>
        {/* Preset Tabs */}
        <ToggleButtonGroup
          value={mode === "buy" ? activeBuyPreset : activeSellPreset}
          exclusive
          onChange={handlePresetChange}
          sx={{ mb: 2, width: "100%" }}
        >
          <ToggleButton value={0} sx={{
            flex: 1,
            color: "#fff",
            border: "1px solid #444",
            '&.Mui-selected': {
              color: "#fff",
              backgroundColor: "#23242a",
              border: "2px solid #fff"
            }
          }}>PRESET 1</ToggleButton>
          <ToggleButton value={1} sx={{
            flex: 1,
            color: "#fff",
            border: "1px solid #444",
            '&.Mui-selected': {
              color: "#fff",
              backgroundColor: "#23242a",
              border: "2px solid #fff"
            }
          }}>PRESET 2</ToggleButton>
          <ToggleButton value={2} sx={{
            flex: 1,
            color: "#fff",
            border: "1px solid #444",
            '&.Mui-selected': {
              color: "#fff",
              backgroundColor: "#23242a",
              border: "2px solid #fff"
            }
          }}>PRESET 3</ToggleButton>
        </ToggleButtonGroup>

        {/* Buy/Sell Toggle */}
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, val) => val && setMode(val)}
          sx={{ mb: 2, width: "100%" }}
        >
          <ToggleButton value="buy" sx={{
            flex: 1,
            color: "#fff",
            border: "1px solid #444",
            '&.Mui-selected': {
              color: "#fff",
              backgroundColor: "#23242a",
              border: "2px solid #fff"
            }
          }}>Buy Settings</ToggleButton>
          <ToggleButton value="sell" sx={{
            flex: 1,
            color: "#fff",
            border: "1px solid #444",
            '&.Mui-selected': {
              color: "#fff",
              backgroundColor: "#23242a",
              border: "2px solid #fff"
            }
          }}>Sell Settings</ToggleButton>
        </ToggleButtonGroup>

        {/* Input Fields Row */}
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <TextField
              label=""
              name="slippage"
              value={form.slippage || ""}
              onChange={handleChange}
              InputProps={{
                startAdornment: <span style={{ opacity: 0.6 }}>⚡</span>,
                style: { color: "#fff" }
              }}
              inputProps={{ style: { color: "#fff" } }}
              InputLabelProps={{ style: { color: "#fff" } }}
              fullWidth
              size="small"
              sx={{ bgcolor: "#23242a", borderRadius: 1, color: "#fff" }}
            />
            <Typography variant="caption" sx={{ color: "#fff" }}>SLIPPAGE</Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <TextField
              label=""
              name="priorityFee"
              value={form.priorityFee || ""}
              onChange={handleChange}
              InputProps={{
                startAdornment: <span style={{ opacity: 0.6 }}>🏷️</span>,
                style: { color: "#fff" }
              }}
              inputProps={{ style: { color: "#fff" } }}
              InputLabelProps={{ style: { color: "#fff" } }}
              fullWidth
              size="small"
              sx={{ bgcolor: "#23242a", borderRadius: 1, color: "#fff" }}
            />
            <Typography variant="caption" sx={{ color: "#fff" }}>PRIORITY</Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <TextField
              label=""
              name="bribeAmount"
              value={form.bribeAmount || ""}
              onChange={handleChange}
              InputProps={{
                startAdornment: <span style={{ opacity: 0.6 }}>💸</span>,
                style: { color: "#fff" }
              }}
              inputProps={{ style: { color: "#fff" } }}
              InputLabelProps={{ style: { color: "#fff" } }}
              fullWidth
              size="small"
              sx={{ bgcolor: "#23242a", borderRadius: 1, color: "#fff" }}
            />
            <Typography variant="caption" sx={{ color: "#fff" }}>BRIBE</Typography>
          </Box>
        </Box>

        {/* Auto Fee and Max Fee */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!form.autoFee}
                onChange={handleChange}
                name="autoFee"
                sx={{ color: "#fff" }}
              />
            }
            label={<span style={{ color: "#fff" }}>Auto Fee</span>}
            sx={{ color: "#fff" }}
          />
          <TextField
            label=""
            name="maxFee"
            value={form.maxFee || ""}
            onChange={handleChange}
            disabled={!!form.autoFee}
            InputProps={{ style: { color: "#fff" } }}
            inputProps={{ style: { color: "#fff" } }}
            InputLabelProps={{ style: { color: "#fff" } }}
            fullWidth
            size="small"
            sx={{ bgcolor: "#23242a", borderRadius: 1, color: "#fff" }}
          />
          <Typography variant="caption" sx={{ color: "#fff", ml: 1 }}>MAX FEE</Typography>
        </Box>

        {/* MEV Mode */}
        <Typography sx={{ color: "#fff", mb: 1 }}>MEV Mode</Typography>
        <ToggleButtonGroup
          value={form.mevMode || "off"}
          exclusive
          onChange={handleMevModeChange}
          sx={{ mb: 2, width: "100%" }}
        >
          <ToggleButton value="off" sx={{
            flex: 1,
            color: "#fff",
            border: "1px solid #444",
            '&.Mui-selected': {
              color: "#fff",
              backgroundColor: "#23242a",
              border: "2px solid #fff"
            }
          }}>⛔ Off</ToggleButton>
          <ToggleButton value="reduced" sx={{
            flex: 1,
            color: "#fff",
            border: "1px solid #444",
            '&.Mui-selected': {
              color: "#fff",
              backgroundColor: "#23242a",
              border: "2px solid #fff"
            }
          }}>🛡️ Reduced</ToggleButton>
          <ToggleButton value="secure" sx={{
            flex: 1,
            color: "#fff",
            border: "1px solid #444",
            '&.Mui-selected': {
              color: "#fff",
              backgroundColor: "#23242a",
              border: "2px solid #fff"
            }
          }}>🛡️ Secure</ToggleButton>
        </ToggleButtonGroup>

        {/* RPC Field */}
        <TextField
          label="RPC"
          name="rpcUrl"
          value={form.rpcUrl || ""}
          onChange={handleChange}
          InputProps={{ style: { color: "#fff" } }}
          inputProps={{ style: { color: "#fff" } }}
          InputLabelProps={{ style: { color: "#fff" } }}
          fullWidth
          size="small"
          sx={{ bgcolor: "#23242a", borderRadius: 1, color: "#fff", mb: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ bgcolor: "#181A20" }}>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: "#4CAF50" }}>
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PresetModal;

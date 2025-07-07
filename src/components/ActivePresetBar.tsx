import React, { useState } from "react";
import { Button, ToggleButton, ToggleButtonGroup } from "@mui/material";

interface ActivePresetBarProps {
  activeBuyPreset: number;
  activeSellPreset: number;
  buyPresets: any[];
  sellPresets: any[];
  setActiveBuyPreset: (idx: number) => void;
  setActiveSellPreset: (idx: number) => void;
  showBuyPresetButtons?: boolean;
  showSellPresetButtons?: boolean;
  ws?: WebSocket | null;
  onOpenSettings: () => void;
  walletAddress?: string;
  solBalance?: number;
  onLogout: () => void;
}

const formatPreset = (type: "B" | "S", idx: number, preset: any) => {
  if (!preset) return null;
  return (
    <span style={{ marginRight: 24 }}>
      <b>{type}</b> P{idx + 1} S {preset.slippage || "-"} P {preset.priorityFee || "-"} B {preset.bribeAmount || "-"}
    </span>
  );
};

const ActivePresetBar: React.FC<ActivePresetBarProps> = ({
  activeBuyPreset,
  activeSellPreset,
  buyPresets,
  sellPresets,
  setActiveBuyPreset,
  setActiveSellPreset,
  showBuyPresetButtons = false,
  showSellPresetButtons = false,
  ws,
  onOpenSettings,
  walletAddress,
  solBalance,
  onLogout
}) => {
  console.log("BuyPresets:", buyPresets, "ActiveBuy:", activeBuyPreset, buyPresets[activeBuyPreset]);
  console.log("SellPresets:", sellPresets, "ActiveSell:", activeSellPreset, sellPresets[activeSellPreset]);

  const [presetMode, setPresetMode] = useState<'buy' | 'sell'>('buy');

  const handlePresetClick = (idx: number) => {
    if (presetMode === 'buy') setActiveBuyPreset(idx);
    else setActiveSellPreset(idx);
    if (ws) ws.send(JSON.stringify({ type: "APPLY_PRESET", mode: presetMode, presetIndex: idx }));
  };

  const activePreset = presetMode === 'buy' ? activeBuyPreset : activeSellPreset;

  return (
    <div
      style={{
        width: "100%",
        background: "#23242a",
        color: "#fff",
        padding: "8px 48px 8px 16px",
        fontSize: "1rem",
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid #444",
        zIndex: 1000,
        position: "fixed",
        top: 0,
        left: 0,
        justifyContent: "space-between"
      }}
    >
      {/* Left: Preset summary */}
      <div>
        {formatPreset("B", activeBuyPreset, buyPresets[activeBuyPreset])}
        {formatPreset("S", activeSellPreset, sellPresets[activeSellPreset])}
      </div>

      {/* Center: Toggle + P1/P2/P3 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ToggleButtonGroup
          value={presetMode}
          exclusive
          onChange={(_, val) => val && setPresetMode(val)}
          size="small"
          sx={{
            background: "#23242a",
            borderRadius: 2,
            boxShadow: "0 0 0 1px #444",
            overflow: "hidden"
          }}
        >
          <ToggleButton
            value="buy"
            sx={{
              color: "#fff",
              fontWeight: "bold",
              backgroundColor: presetMode === "buy" ? "#6A5ACD" : "transparent",
              '&.Mui-selected': {
                backgroundColor: "#6A5ACD",
                color: "#fff",
                fontWeight: "bold",
                //border: "2px solid #fff"
              },
              '&:hover': {
                backgroundColor: "#7B68EE"
              },
              minWidth: 60
            }}
          >
            BUY
          </ToggleButton>
          <ToggleButton
            value="sell"
            sx={{
              color: "#fff",
              fontWeight: "bold",
              backgroundColor: presetMode === "sell" ? "#e53935" : "transparent",
              '&.Mui-selected': {
                backgroundColor: "#e53935",
                color: "#fff",
                fontWeight: "bold",
                //border: "2px solid #fff"
              },
              '&:hover': {
                backgroundColor: "#ff6659"
              },
              minWidth: 60
            }}
          >
            SELL
          </ToggleButton>
        </ToggleButtonGroup>
        {[0, 1, 2].map(idx => (
          <button
            key={idx}
            onClick={() => handlePresetClick(idx)}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              border: idx === activePreset ? "2px solid #fff" : "1px solid #888",
              background: idx === activePreset ? "#6A5ACD" : "#23242a",
              color: "#fff",
              fontWeight: idx === activePreset ? "bold" : "normal",
              cursor: "pointer"
            }}
          >
            P{idx + 1}
          </button>
        ))}
      </div>

      {/* Right: Settings, wallet, balance, logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 24 }}>
        <button
          onClick={onOpenSettings}
          style={{
            fontSize: 22,
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          <span role="img" aria-label="settings">⚙️</span>
        </button>
        {walletAddress && (
          <span
            style={{
              color: '#FFD700',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center'
            }}
            title="Copy address"
            onClick={() => navigator.clipboard.writeText(walletAddress)}
          >
            <span role="img" aria-label="wallet" style={{ marginRight: 2 }}>💰</span>
            <span>{walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}</span>
          </span>
        )}
        {typeof solBalance === 'number' && (
          <span style={{ color: '#fff', fontWeight: 500, fontSize: 16, marginLeft: 4 }}>
            {solBalance} SOL
          </span>
        )}
        <Button
          onClick={onLogout}
          sx={{
            color: 'white',
            fontWeight: 600,
            fontSize: 16,
            marginLeft: 8,
            minWidth: 0,
            px: 2,
            whiteSpace: 'nowrap'
          }}
        >
          Logout
        </Button>
      </div>
    </div>
  );
};

export default ActivePresetBar;

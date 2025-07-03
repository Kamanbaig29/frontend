import React from "react";

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
}) => {
  console.log("BuyPresets:", buyPresets, "ActiveBuy:", activeBuyPreset, buyPresets[activeBuyPreset]);
  console.log("SellPresets:", sellPresets, "ActiveSell:", activeSellPreset, sellPresets[activeSellPreset]);

  const handleBuyPresetClick = (idx: number) => {
    setActiveBuyPreset(idx);
    if (ws) ws.send(JSON.stringify({ type: "APPLY_PRESET", mode: "buy", presetIndex: idx }));
  };

  const handleSellPresetClick = (idx: number) => {
    setActiveSellPreset(idx);
    if (ws) ws.send(JSON.stringify({ type: "APPLY_PRESET", mode: "sell", presetIndex: idx }));
  };

  return (
    <div style={{
      width: "100%",
      background: "#23242a",
      color: "#fff",
      padding: "8px 16px",
      fontSize: "1rem",
      display: "flex",
      alignItems: "center",
      borderBottom: "1px solid #444",
      zIndex: 1000,
      position: "fixed",
      top: 0,
      left: 0,
      justifyContent: "space-between"
    }}>
      <div>
        {formatPreset("B", activeBuyPreset, buyPresets[activeBuyPreset])}
        {formatPreset("S", activeSellPreset, sellPresets[activeSellPreset])}
      </div>
      {showBuyPresetButtons && (
        <div>
          {[0, 1, 2].map(idx => (
            <button
              key={idx}
              onClick={() => handleBuyPresetClick(idx)}
              style={{
                marginLeft: 8,
                padding: "4px 12px",
                borderRadius: 4,
                border: idx === activeBuyPreset ? "2px solid #fff" : "1px solid #888",
                background: idx === activeBuyPreset ? "#6A5ACD" : "#23242a",
                color: "#fff",
                fontWeight: idx === activeBuyPreset ? "bold" : "normal",
                cursor: "pointer"
              }}
            >
              P{idx + 1}
            </button>
          ))}
        </div>
      )}
      {showSellPresetButtons && (
        <div>
          {[0, 1, 2].map(idx => (
            <button
              key={idx}
              onClick={() => handleSellPresetClick(idx)}
              style={{
                marginLeft: 8,
                padding: "4px 12px",
                borderRadius: 4,
                border: idx === activeSellPreset ? "2px solid #fff" : "1px solid #888",
                background: idx === activeSellPreset ? "#6A5ACD" : "#23242a",
                color: "#fff",
                fontWeight: idx === activeSellPreset ? "bold" : "normal",
                cursor: "pointer"
              }}
            >
              P{idx + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivePresetBar;

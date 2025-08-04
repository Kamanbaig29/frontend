import React, { useState, useEffect } from "react";
import {
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import { useWebSocket } from "../context/webSocketContext";
import BuySellFilterPanel, {
  type BuyFilters,
  type SellFilters,
} from "./BuySellFilterPanel";
import styles from "../assets/TokenDetails.module.css";

type Token = {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  creationTimestamp: number;
  currentPrice?: number;
  buyAmount?: number;
  balance?: number;
  autoSellEnabled?: boolean;
  takeProfit?: number;
  stopLoss?: number;
  autoSellPercent?: number;
  creator?: string;
  devAddress?: string;
};

interface TokenDetailsProps {
  open: boolean;
  onClose: () => void;
  token: Token | null;
  onAutoSellToggle?: (token: Token) => void;
  onTakeProfitChange?: (mint: string, value: string) => void;
  onStopLossChange?: (mint: string, value: string) => void;
  onAutoSellPercentChange?: (mint: string, value: string) => void;
  onTrailingStopLossChange?: (mint: string, value: string) => void;
  onTrailingStopLossEnabledChange?: (mint: string, checked: boolean) => void;
  onTimeBasedSellChange?: (mint: string, value: string) => void;
  onTimeBasedSellEnabledChange?: (mint: string, checked: boolean) => void;
  onWaitForBuyersChange?: (mint: string, value: string) => void;
  onWaitForBuyersEnabledChange?: (mint: string, checked: boolean) => void;
  autoSellEnabledState?: { [key: string]: boolean };
  takeProfitState?: { [key: string]: string };
  stopLossState?: { [key: string]: string };
  autoSellPercentState?: { [key: string]: string };
  trailingStopLossState?: { [key: string]: string };
  trailingStopLossEnabledState?: { [key: string]: boolean };
  timeBasedSellState?: { [key: string]: string };
  timeBasedSellEnabledState?: { [key: string]: boolean };
  waitForBuyersState?: { [key: string]: string };
  waitForBuyersEnabledState?: { [key: string]: boolean };
}

const TokenDetails: React.FC<TokenDetailsProps> = ({ 
  open, 
  onClose, 
  token,
  onAutoSellToggle,
  onTakeProfitChange,
  onStopLossChange,
  onAutoSellPercentChange,
  onTrailingStopLossChange,
  onTrailingStopLossEnabledChange,
  onTimeBasedSellChange,
  onTimeBasedSellEnabledChange,
  onWaitForBuyersChange,
  onWaitForBuyersEnabledChange,
  autoSellEnabledState,
  takeProfitState,
  stopLossState,
  autoSellPercentState,
  trailingStopLossState,
  trailingStopLossEnabledState,
  timeBasedSellState,
  timeBasedSellEnabledState,
  waitForBuyersState,
  waitForBuyersEnabledState
}) => {
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [buyFilters, setBuyFilters] = useState<BuyFilters>({});
  const [sellFilters, setSellFilters] = useState<SellFilters>({});
  const [solBalance, setSolBalance] = useState<number>(0);

  const { ws, walletAddress, buyPresets, sellPresets, activeBuyPreset, activeSellPreset } = useWebSocket();
  const userId = localStorage.getItem("userId") || "default";

  const autoSellEnabled = token ? (autoSellEnabledState?.[token.mint] || false) : false;
  const takeProfit = token ? (takeProfitState?.[token.mint] || "") : "";
  const stopLoss = token ? (stopLossState?.[token.mint] || "") : "";
  const autoSellPercent = token ? (autoSellPercentState?.[token.mint] || "") : "";
  const trailingStopLoss = token ? (trailingStopLossState?.[token.mint] || "") : "";
  const trailingStopLossEnabled = token ? (trailingStopLossEnabledState?.[token.mint] || false) : false;
  const timeBasedSell = token ? (timeBasedSellState?.[token.mint] || "") : "";
  const timeBasedSellEnabled = token ? (timeBasedSellEnabledState?.[token.mint] || false) : false;
  const waitForBuyers = token ? (waitForBuyersState?.[token.mint] || "") : "";
  const waitForBuyersEnabled = token ? (waitForBuyersEnabledState?.[token.mint] || false) : false;

  const handleAutoSellToggle = () => {
    if (token && onAutoSellToggle) {
      onAutoSellToggle(token);
    }
  };

  const handleTakeProfitChange = (value: string) => {
    if (token && onTakeProfitChange) {
      onTakeProfitChange(token.mint, value);
    }
  };

  const handleStopLossChange = (value: string) => {
    if (token && onStopLossChange) {
      onStopLossChange(token.mint, value);
    }
  };

  const handleAutoSellPercentChange = (value: string) => {
    if (token && onAutoSellPercentChange) {
      onAutoSellPercentChange(token.mint, value);
    }
  };

  const handleTrailingStopLossChange = (value: string) => {
    if (token && onTrailingStopLossChange) {
      onTrailingStopLossChange(token.mint, value);
    }
  };

  const handleTrailingStopLossEnabledChange = (checked: boolean) => {
    if (token && onTrailingStopLossEnabledChange) {
      onTrailingStopLossEnabledChange(token.mint, checked);
    }
  };

  const handleTimeBasedSellChange = (value: string) => {
    if (token && onTimeBasedSellChange) {
      onTimeBasedSellChange(token.mint, value);
    }
  };

  const handleTimeBasedSellEnabledChange = (checked: boolean) => {
    if (token && onTimeBasedSellEnabledChange) {
      onTimeBasedSellEnabledChange(token.mint, checked);
    }
  };

  const handleWaitForBuyersChange = (value: string) => {
    if (token && onWaitForBuyersChange) {
      onWaitForBuyersChange(token.mint, value);
    }
  };

  const handleWaitForBuyersEnabledChange = (checked: boolean) => {
    if (token && onWaitForBuyersEnabledChange) {
      onWaitForBuyersEnabledChange(token.mint, checked);
    }
  };

  const handleBuy = () => {
    if (!ws || !token) return;
    
    const preset = buyPresets[activeBuyPreset] || {};
    const amountLamports = Math.floor(0.1 * 1e9); // Default 0.1 SOL
    const toLamports = (val: string) => Math.floor(Number(val) * 1e9);

    ws.send(
      JSON.stringify({
        type: "MANUAL_BUY",
        mintAddress: token.mint,
        amount: amountLamports,
        slippage: preset.slippage,
        priorityFee: toLamports(preset.priorityFee),
        bribeAmount: toLamports(preset.bribeAmount),
      })
    );
  };

  const handleSell = () => {
    if (!ws || !token) return;
    
    const preset = sellPresets[activeSellPreset] || {};
    ws.send(
      JSON.stringify({
        type: "MANUAL_SELL",
        mintAddress: token.mint,
        percent: 100,
        slippage: preset.slippage,
        priorityFee: Number(preset.priorityFee),
        bribeAmount: Number(preset.bribeAmount),
        walletAddress,
      })
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle className={styles.dialogTitle}>
        {token?.name || "Token Details"}
        <Button onClick={onClose} className={styles.closeButton}>
          ×
        </Button>
      </DialogTitle>
      <DialogContent className={styles.dialogContent}>

        {token && (
          <div className={styles.tokenDetails}>
            <div className={styles.tokenHeader}>
              {token.imageUrl && (
                <img src={token.imageUrl} alt={token.name} className={styles.tokenImage} />
              )}
              <div className={styles.tokenInfo}>
                <h2 className={styles.tokenName}>{token.name}</h2>
                <p className={styles.tokenSymbol}>{token.symbol}</p>
                <p className={styles.tokenPrice}>
                  ${token.currentPrice?.toFixed(8) || "0.00000000"}
                </p>
              </div>
            </div>

            <div className={styles.tokenMeta}>
              <p><strong>Mint:</strong> {token.mint}</p>
              <p><strong>Creator:</strong> {token.creator || token.devAddress || "Unknown"}</p>
              <p><strong>Age:</strong> {Math.floor((Date.now() - token.creationTimestamp) / 1000 / 60)}m</p>
            </div>



          {token.balance && (
            <div className={styles.ownedSection}>
              <h3>Your Holdings</h3>
              <div className={styles.holdingsInfo}>
                <p><strong>Balance:</strong> {token.balance} {token.symbol}</p>
                {token.buyAmount && (
                  <p><strong>Buy Price:</strong> ${token.buyAmount}</p>
                )}
                {token.buyTime && (
                  <p><strong>Bought:</strong> {new Date(token.buyTime).toLocaleString()}</p>
                )}
              </div>
              
              <div className={styles.autoSellSection}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoSellEnabled}
                      onChange={handleAutoSellToggle}
                      color="primary"
                    />
                  }
                  label="Auto Sell"
                  className={styles.autoSellToggle}
                />

                <div className={styles.autoSellControls}>
                  <TextField
                    label="Take Profit %"
                    type="number"
                    value={takeProfit}
                    onChange={(e) => handleTakeProfitChange(e.target.value)}
                    className={styles.input}
                    size="small"
                    disabled={!autoSellEnabled}
                  />
                  <TextField
                    label="Stop Loss %"
                    type="number"
                    value={stopLoss}
                    onChange={(e) => handleStopLossChange(e.target.value)}
                    className={styles.input}
                    size="small"
                    disabled={!autoSellEnabled}
                  />
                  <TextField
                    label="Auto Sell %"
                    type="number"
                    value={autoSellPercent}
                    onChange={(e) => handleAutoSellPercentChange(e.target.value)}
                    className={styles.input}
                    size="small"
                    disabled={!autoSellEnabled}
                  />
                </div>

                <div className={styles.advancedControls}>
                  <div className={styles.controlRow}>
                    <TextField
                      label="Trailing Stop Loss (%)"
                      type="number"
                      value={trailingStopLoss}
                      onChange={(e) => handleTrailingStopLossChange(e.target.value)}
                      className={styles.input}
                      size="small"
                      disabled={!autoSellEnabled || !trailingStopLossEnabled || timeBasedSellEnabled}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={trailingStopLossEnabled}
                          onChange={(e) => handleTrailingStopLossEnabledChange(e.target.checked)}
                          color="primary"
                          size="small"
                          disabled={!autoSellEnabled || timeBasedSellEnabled}
                        />
                      }
                      label="On/Off"
                      className={styles.switchLabel}
                    />
                  </div>

                  <div className={styles.controlRow}>
                    <TextField
                      label="Wait for Buyers Before Sell"
                      type="number"
                      value={waitForBuyers}
                      onChange={(e) => handleWaitForBuyersChange(e.target.value)}
                      className={styles.input}
                      size="small"
                      disabled={!autoSellEnabled || !waitForBuyersEnabled}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={waitForBuyersEnabled}
                          onChange={(e) => handleWaitForBuyersEnabledChange(e.target.checked)}
                          color="primary"
                          size="small"
                          disabled={!autoSellEnabled}
                        />
                      }
                      label="On/Off"
                      className={styles.switchLabel}
                    />
                  </div>

                  <div className={styles.controlRow}>
                    <TextField
                      label="Time-Based Sell (sec)"
                      type="number"
                      value={timeBasedSell}
                      onChange={(e) => handleTimeBasedSellChange(e.target.value)}
                      className={styles.input}
                      size="small"
                      disabled={!autoSellEnabled || !timeBasedSellEnabled}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={timeBasedSellEnabled}
                          onChange={(e) => handleTimeBasedSellEnabledChange(e.target.checked)}
                          color="primary"
                          size="small"
                          disabled={!autoSellEnabled}
                        />
                      }
                      label="On/Off"
                      className={styles.switchLabel}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <Button onClick={handleBuy} className={styles.buyButton}>
              Buy
            </Button>
            {token.balance && (
              <Button onClick={handleSell} className={styles.sellButton}>
                Sell
              </Button>
            )}
            <Button onClick={() => setShowFilters(true)} className={styles.filtersButton}>
              Filters
            </Button>
          </div>
          </div>
        )}
      </DialogContent>
      
      <BuySellFilterPanel
        open={showFilters}
        onClose={() => setShowFilters(false)}
        userId={userId}
        buyFilters={buyFilters}
        sellFilters={sellFilters}
        onChangeBuyFilters={setBuyFilters}
        onChangeSellFilters={setSellFilters}
      />
    </Dialog>
  );
};

export default TokenDetails;
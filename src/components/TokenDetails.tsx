import React, { useState } from "react";
import { useEffect, useRef } from "react";

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
import Navbar from "./Navbar";
import FooterBar from "./FooterBar";
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";
import PresetModal from "./PresetModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  // faUser,
  // faGlobe,
  faPills,
  faMagnifyingGlass,
  faCopy,
  faGasPump,
  faCoins,
  faPersonFallingBurst,
} from "@fortawesome/free-solid-svg-icons";
import { faTelegram } from "@fortawesome/free-brands-svg-icons";
import styles from "../assets/TokenDetails.module.css";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import { faGasPump, faCoins, faPersonFallingBurst } from "@fortawesome/free-solid-svg-icons";

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
  fullPage?: boolean;
  solBalance?: number;
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
  fullPage = false,
  solBalance: propSolBalance,
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
  waitForBuyersEnabledState,
}) => {
  // const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [buyFilters, setBuyFilters] = useState<BuyFilters>({});
  const [sellFilters, setSellFilters] = useState<SellFilters>({});
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  // const [solBalance, setSolBalance] = useState<number>(0);

  const {
    ws,
    walletAddress,
    buyPresets,
    sellPresets,
    activeBuyPreset,
    activeSellPreset,
    setActiveBuyPreset,
    setActiveSellPreset,
  } = useWebSocket();
  const userId = localStorage.getItem("userId") || "default";
  const [solBalance, setSolBalance] = useState<number>(propSolBalance || 0);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [userTokens, setUserTokens] = useState<any[]>([]);
  const [buyAmount, setBuyAmount] = useState<string>("0.1");
  // const [advancedSettingsEnabled, setAdvancedSettingsEnabled] = useState(false);

  useEffect(() => {
    if (!ws) return;

    // Request user tokens and SOL balance when component opens
    ws.send(JSON.stringify({ type: "GET_MY_TOKENS" }));
    ws.send(JSON.stringify({ type: "GET_SOL_BALANCE" }));

    const handleMessage = async (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === "SOL_BALANCE_UPDATE") {
        setSolBalance(data.balance);
      } else if (data.type === "MY_TOKENS_UPDATE") {
        setUserTokens(data.tokens || []);
      }
    };
    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws]);

  const autoSellEnabled = token
    ? autoSellEnabledState?.[token.mint] || false
    : false;
  const takeProfit = token ? takeProfitState?.[token.mint] || "" : "";
  const stopLoss = token ? stopLossState?.[token.mint] || "" : "";
  const autoSellPercent = token ? autoSellPercentState?.[token.mint] || "" : "";
  const trailingStopLoss = token
    ? trailingStopLossState?.[token.mint] || ""
    : "";
  const trailingStopLossEnabled = token
    ? trailingStopLossEnabledState?.[token.mint] || false
    : false;
  const timeBasedSell = token ? timeBasedSellState?.[token.mint] || "" : "";
  const timeBasedSellEnabled = token
    ? timeBasedSellEnabledState?.[token.mint] || false
    : false;
  const waitForBuyers = token ? waitForBuyersState?.[token.mint] || "" : "";
  const waitForBuyersEnabled = token
    ? waitForBuyersEnabledState?.[token.mint] || false
    : false;
  // Get user's balance for this token from userTokens array
  const userToken = token
    ? userTokens.find((t) => t.mint === token.mint)
    : null;
  const userBalance = userToken?.balance || token?.balance || 0;
  // const hasBalance = userBalance > 0;

  // Debug logging
  console.log("TokenDetails Debug:", {
    tokenMint: token?.mint,
    userTokensLength: userTokens.length,
    userToken,
    userBalance,
    tokenBalance: token?.balance,
  });

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!open) return;

    const loadTradingView = () => {
      if (!(window as any).TradingView) {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => initChart();
        document.head.appendChild(script);
      } else {
        initChart();
      }
    };

    const initChart = () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
      }

      widgetRef.current = new (window as any).TradingView.widget({
        autosize: true,
        symbol: "BINANCE:BTCUSDT",
        interval: "5",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#1a1a1a",
        enable_publishing: false,
        allow_symbol_change: false,
        hide_top_toolbar: false,
        hide_legend: false,
        hide_side_toolbar: false,
        save_image: false,
        container_id: "tradingview_chart",
        enabled_features: [
          "left_toolbar",
          "header_widget",
          "timeframes_toolbar",
          "header_chart_type",
          "header_undo_redo",
        ],
        disabled_features: [
          "header_symbol_search",
          "header_fullscreen_button",
          "header_screenshot",
          "volume_force_overlay",
          "create_volume_indicator_by_default",
          "study_dialog_search_control",
        ],
        overrides: {
          "paneProperties.background": "#1a1a1a",
          "paneProperties.vertGridProperties.color": "#333",
          "paneProperties.horzGridProperties.color": "#333",
        },
      });
    };

    loadTradingView();

    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [open]);

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
    const amountLamports = Math.floor(Number(buyAmount) * 1e9);
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

  const bind = (fn?: (mint: string, value: any) => void) =>
    fn && token ? (val: any) => fn(token.mint, val) : () => {};

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

  if (fullPage) {
    return (
      <div className={styles.pageContainer}>
        <Navbar
          showMyTokens={false}
          onMyTokensClick={() => {}}
          onDepositClick={() => setDepositModalOpen(true)}
          onWithdrawClick={() => setWithdrawModalOpen(true)}
          onLogout={() => {
            const token = localStorage.getItem("token");
            if (token) {
              fetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/bot/stop-services`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                }
              );
            }
            localStorage.removeItem("token");
            localStorage.removeItem("userId");
            window.location.href = "/";
          }}
          solBalance={propSolBalance || solBalance}
        />

        <main className={styles.mainContent}>
          {token && (
            <>
              {/* Token Header Section */}
              <div className={styles.tokenHeaderSection}>
                <div className={styles.tokenHeaderContent}>
                  <div className={styles.tokenBasicInfo}>
                    {token.imageUrl && (
                      <img
                        src={token.imageUrl}
                        alt={token.name}
                        className={styles.tokenLogo}
                      />
                    )}
                    <div className={styles.tokenTitleInfo}>
                      <div className={styles.tokenNameRow}>
                        <h1 className={styles.tokenTitle}>{token.name}</h1>
                        <span
                          className={styles.tokenSymbolCopy}
                          onClick={() =>
                            navigator.clipboard.writeText(token.mint)
                          }
                          title="Copy mint address"
                        >
                          {token.symbol}
                          <FontAwesomeIcon
                            icon={faCopy}
                            className={styles.copyIcon}
                          />
                        </span>
                      </div>
                      <div className={styles.creatorRow}>
                        <span
                          className={styles.creatorAddress}
                          onClick={() =>
                            navigator.clipboard.writeText(
                              token.creator || token.devAddress || ""
                            )
                          }
                          title="Copy creator address"
                        >
                          {(
                            token.creator ||
                            token.devAddress ||
                            "Unknown"
                          ).substring(0, 4)}
                          ...
                          {(
                            token.creator ||
                            token.devAddress ||
                            "Unknown"
                          ).slice(-4)}
                        </span>
                        <div className={styles.socialIcons}>
                          <FontAwesomeIcon
                            icon={faTelegram}
                            className={styles.socialIcon}
                          />
                          <FontAwesomeIcon
                            icon={faPills}
                            className={styles.socialIcon}
                          />
                          <FontAwesomeIcon
                            icon={faMagnifyingGlass}
                            className={styles.socialIcon}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.tokenStats}>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Price</span>
                      <span className={styles.statValue}>
                        ${token.currentPrice?.toFixed(8) || "0.00000000"}
                      </span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>B.Curve</span>
                      <span className={styles.statValue}>11.1%</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Market Cap</span>
                      <span className={styles.statValue}>$2.4M</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Volume 24h</span>
                      <span className={styles.statValue}>$456K</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Age</span>
                      <span className={styles.statValue}>
                        {Math.floor(
                          (Date.now() - token.creationTimestamp) / 1000 / 60
                        )}
                        m
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className={styles.contentGrid}>
                {/* Chart and Trading Panel */}
                <div className={styles.chartTradingSection}>
                  <div className={styles.chartContainer}>
                    <div
                      id="tradingview_chart"
                      ref={chartContainerRef}
                      className={styles.chart}
                    />
                  </div>
                  <div className={styles.tradingPanel}>
                    <div className={styles.tradingTabs}>
                      <button
                        className={`${styles.tabButton} ${styles.buyTab} ${activeTab === "buy" ? styles.activeBuyTab : ""}`}
                        onClick={() => setActiveTab("buy")}
                      >
                        Buy
                      </button>
                      <button
                        className={`${styles.tabButton} ${styles.sellTab} ${activeTab === "sell" ? styles.activeSellTab : ""}`}
                        onClick={() => setActiveTab("sell")}
                      >
                        Sell
                      </button>
                    </div>
                    <div className={styles.tradingForm}>
                      {activeTab === "buy" ? (
                        <>
                          
                          <div className={styles.buyAmountContainer}>
                            <TextField
                              label="Buy Amount (SOL)"
                              type="number"
                              value={buyAmount}
                              onChange={(e) => setBuyAmount(e.target.value)}
                              className={styles.buyAmountInput}
                              size="small"
                              variant="outlined"
                              sx={{
                                width: '100%',
                                "& .MuiOutlinedInput-root": {
                                  backgroundColor: "#2a2a2a",
                                  color: "#ffffff",
                                  paddingRight: '40px',
                                  "& fieldset": {
                                    borderColor: "#444",
                                  },
                                  "&:hover fieldset": {
                                    borderColor: "#666",
                                  },
                                  "&.Mui-focused fieldset": {
                                    borderColor: "#00d4aa",
                                  },
                                  "& input[type=number]": {
                                    "-moz-appearance": "textfield",
                                  },
                                  "& input[type=number]::-webkit-outer-spin-button": {
                                    "-webkit-appearance": "none",
                                    margin: 0,
                                  },
                                  "& input[type=number]::-webkit-inner-spin-button": {
                                    "-webkit-appearance": "none",
                                    margin: 0,
                                  },
                                },
                                "& .MuiInputLabel-root": {
                                  color: "#aaa",
                                  "&.Mui-focused": {
                                    color: "#00d4aa",
                                  },
                                },
                              }}
                            />
                            <img 
                              src="/footerIcon/solana.png" 
                              alt="SOL" 
                              className={styles.solIcon}
                            />
                          </div>
                          <div className={styles.presetTableContainer}>
                            <table className={styles.presetTable}>
                              <thead>
                                <tr>
                                  <th>Slippage</th>
                                  <th>Priority</th>
                                  <th>Bribe</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>
                                    <FontAwesomeIcon
                                      icon={faPersonFallingBurst}
                                      style={{ marginRight: 6 }}
                                    />
                                    {buyPresets[activeBuyPreset]?.slippage ||
                                      "N/A"}
                                    %
                                  </td>
                                  <td>
                                    <FontAwesomeIcon
                                      icon={faGasPump}
                                      style={{ marginRight: 6 }}
                                    />
                                    {buyPresets[activeBuyPreset]?.priorityFee ||
                                      "N/A"}{" "}
                                    SOL
                                  </td>
                                  <td>
                                    <FontAwesomeIcon
                                      icon={faCoins}
                                      style={{ marginRight: 6 }}
                                    />
                                    {buyPresets[activeBuyPreset]?.bribeAmount ||
                                      "N/A"}{" "}
                                    SOL
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <div className={styles.advancedSettingsCheckbox} onClick={() => setShowFilters(true)}>
                            <div className={`${styles.checkbox} ${styles.checked}`}>
                              <div className={styles.checkboxInner}></div>
                            </div>
                            <span className={styles.checkboxLabel}>Advanced Settings</span>
                          </div>

                          <Button
                            onClick={handleBuy}
                            className={styles.buyButtonStyled}
                            fullWidth
                            variant="contained"
                            sx={{
                              backgroundColor: "#00d4aa",
                              color: "#000",
                              fontWeight: "bold",
                              fontSize: "16px",
                              padding: "12px",
                              borderRadius: "8px",
                              textTransform: "none",
                              "&:hover": {
                                backgroundColor: "#00b894",
                              },
                            }}
                          >
                            Buy {buyAmount} SOL of {token.symbol}
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className={styles.ownedSection}>
                            <h3>Your Holdings</h3>
                            <div className={styles.holdingsInfo}>
                              <p>
                                <strong>Balance:</strong> {userBalance}{" "}
                                {token.symbol}
                              </p>
                              {(userToken?.buyAmount || token.buyAmount) && (
                                <p>
                                  <strong>Buy Price:</strong> $
                                  {userToken?.buyAmount || token.buyAmount}
                                </p>
                              )}
                            </div>
                          </div>

                          <FormControlLabel
                            control={
                              <Switch
                                checked={autoSellEnabled}
                                onChange={handleAutoSellToggle}
                                color="primary"
                                size="small"
                              />
                            }
                            label="Auto Sell"
                            className={styles.autoSellToggle}
                          />

                          <TextField
                            label="Sell Percentage (%)"
                            type="number"
                            defaultValue="100"
                            className={styles.amountInput}
                            size="small"
                          />
                          <TextField
                            label="Take Profit %"
                            type="number"
                            value={takeProfit}
                            onChange={(e) =>
                              handleTakeProfitChange(e.target.value)
                            }
                            className={styles.amountInput}
                            size="small"
                            disabled={!autoSellEnabled}
                          />
                          <TextField
                            label="Stop Loss %"
                            type="number"
                            value={stopLoss}
                            onChange={(e) =>
                              handleStopLossChange(e.target.value)
                            }
                            className={styles.amountInput}
                            size="small"
                            disabled={!autoSellEnabled}
                          />
                          <TextField
                            label="Auto Sell %"
                            type="number"
                            value={autoSellPercent}
                            onChange={(e) =>
                              handleAutoSellPercentChange(e.target.value)
                            }
                            className={styles.amountInput}
                            size="small"
                            disabled={!autoSellEnabled}
                          />
                          <TextField
                            label="Trailing Stop Loss (%)"
                            type="number"
                            value={trailingStopLoss}
                            onChange={(e) =>
                              handleTrailingStopLossChange(e.target.value)
                            }
                            className={styles.amountInput}
                            size="small"
                            disabled={
                              !autoSellEnabled ||
                              !trailingStopLossEnabled ||
                              timeBasedSellEnabled
                            }
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={trailingStopLossEnabled}
                                onChange={(e) =>
                                  handleTrailingStopLossEnabledChange(
                                    e.target.checked
                                  )
                                }
                                color="primary"
                                size="small"
                                disabled={
                                  !autoSellEnabled || timeBasedSellEnabled
                                }
                              />
                            }
                            label="On/Off"
                            className={styles.switchLabel}
                          />
                          <TextField
                            label="Time-Based Sell (sec)"
                            type="number"
                            value={timeBasedSell}
                            onChange={(e) =>
                              handleTimeBasedSellChange(e.target.value)
                            }
                            className={styles.amountInput}
                            size="small"
                            disabled={!autoSellEnabled || !timeBasedSellEnabled}
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={timeBasedSellEnabled}
                                onChange={(e) =>
                                  handleTimeBasedSellEnabledChange(
                                    e.target.checked
                                  )
                                }
                                color="primary"
                                size="small"
                                disabled={!autoSellEnabled}
                              />
                            }
                            label="On/Off"
                            className={styles.switchLabel}
                          />
                          <TextField
                            label="Wait for Buyers Before Sell"
                            type="number"
                            value={waitForBuyers}
                            onChange={(e) =>
                              handleWaitForBuyersChange(e.target.value)
                            }
                            className={styles.amountInput}
                            size="small"
                            disabled={!autoSellEnabled || !waitForBuyersEnabled}
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={waitForBuyersEnabled}
                                onChange={(e) =>
                                  handleWaitForBuyersEnabledChange(
                                    e.target.checked
                                  )
                                }
                                color="primary"
                                size="small"
                                disabled={!autoSellEnabled}
                              />
                            }
                            label="On/Off"
                            className={styles.switchLabel}
                          />
                          <Button
                            onClick={handleSell}
                            className={styles.sellButton}
                            fullWidth
                          >
                            Sell {token.symbol}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto-Sell Section */}
              <div className={styles.autoSellSection}>
                <div className={styles.ownedSection}>
                  <h3>Your Holdings</h3>
                  <div className={styles.holdingsInfo}>
                    <p>
                      <strong>Balance:</strong> {userBalance} {token.symbol}
                    </p>
                    {(userToken?.buyAmount || token.buyAmount) && (
                      <p>
                        <strong>Buy Price:</strong> $
                        {userToken?.buyAmount || token.buyAmount}
                      </p>
                    )}
                    {/* {(userToken?.buyTime || token.buyTime) && (
                        <p><strong>Bought:</strong> {new Date(userToken?.buyTime || token.buyTime).toLocaleString()}</p>
                      )} */}
                  </div>
                </div>

                <div className={styles.autoSellHeader}>
                  <h3>Auto-Sell Settings</h3>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoSellEnabled}
                        onChange={handleAutoSellToggle}
                        color="primary"
                      />
                    }
                    label="Enable Auto-Sell"
                    className={styles.autoSellToggle}
                  />
                </div>

                {autoSellEnabled && (
                  <div className={styles.autoSellControls}>
                    <div className={styles.controlRow}>
                      <TextField
                        label="Take Profit %"
                        type="number"
                        value={takeProfit}
                        onChange={(e) => handleTakeProfitChange(e.target.value)}
                        className={styles.input}
                        size="small"
                      />
                      <TextField
                        label="Stop Loss %"
                        type="number"
                        value={stopLoss}
                        onChange={(e) => handleStopLossChange(e.target.value)}
                        className={styles.input}
                        size="small"
                      />
                      <TextField
                        label="Auto Sell %"
                        type="number"
                        value={autoSellPercent}
                        onChange={(e) =>
                          handleAutoSellPercentChange(e.target.value)
                        }
                        className={styles.input}
                        size="small"
                      />
                    </div>

                    <div className={styles.controlRow}>
                      <TextField
                        label="Trailing Stop Loss %"
                        type="number"
                        value={trailingStopLoss}
                        onChange={(e) =>
                          handleTrailingStopLossChange(e.target.value)
                        }
                        className={styles.input}
                        size="small"
                        disabled={!trailingStopLossEnabled}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={trailingStopLossEnabled}
                            onChange={(e) =>
                              handleTrailingStopLossEnabledChange(
                                e.target.checked
                              )
                            }
                            color="primary"
                            size="small"
                            disabled={timeBasedSellEnabled}
                          />
                        }
                        label="Enable Trailing"
                        className={styles.switchLabel}
                      />
                    </div>

                    <div className={styles.controlRow}>
                      <TextField
                        label="Time-Based Sell (sec)"
                        type="number"
                        value={timeBasedSell}
                        onChange={(e) =>
                          handleTimeBasedSellChange(e.target.value)
                        }
                        className={styles.input}
                        size="small"
                        disabled={!timeBasedSellEnabled}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={timeBasedSellEnabled}
                            onChange={(e) =>
                              handleTimeBasedSellEnabledChange(e.target.checked)
                            }
                            color="primary"
                            size="small"
                          />
                        }
                        label="Enable Time-Based"
                        className={styles.switchLabel}
                      />
                    </div>

                    <div className={styles.controlRow}>
                      <TextField
                        label="Wait for Buyers"
                        type="number"
                        value={waitForBuyers}
                        onChange={(e) =>
                          handleWaitForBuyersChange(e.target.value)
                        }
                        className={styles.input}
                        size="small"
                        disabled={!waitForBuyersEnabled}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={waitForBuyersEnabled}
                            onChange={(e) =>
                              handleWaitForBuyersEnabledChange(e.target.checked)
                            }
                            color="primary"
                            size="small"
                          />
                        }
                        label="Enable Wait for Buyers"
                        className={styles.switchLabel}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Data Section */}
              <div className={styles.dataSection}>
                <div className={styles.dataGrid}>
                  <div className={styles.dataCard}>
                    <h3>Token Info</h3>
                    <div className={styles.dataRow}>
                      <span>Contract:</span>
                      <span className={styles.contractAddress}>
                        {token.mint.slice(0, 8)}...{token.mint.slice(-8)}
                      </span>
                    </div>
                    <div className={styles.dataRow}>
                      <span>Creator:</span>
                      <span>
                        {(token.creator || token.devAddress || "Unknown").slice(
                          0,
                          8
                        )}
                        ...
                      </span>
                    </div>
                    <div className={styles.dataRow}>
                      <span>Total Supply:</span>
                      <span>1,000,000,000</span>
                    </div>
                  </div>

                  <div className={styles.dataCard}>
                    <h3>Holders</h3>
                    <div className={styles.dataRow}>
                      <span>Total Holders:</span>
                      <span>1,234</span>
                    </div>
                    <div className={styles.dataRow}>
                      <span>Top 10 Holdings:</span>
                      <span>45.2%</span>
                    </div>
                    <div className={styles.dataRow}>
                      <span>Liquidity:</span>
                      <span>$125K</span>
                    </div>
                  </div>

                  <div className={styles.dataCard}>
                    <h3>Trading Stats</h3>
                    <div className={styles.dataRow}>
                      <span>24h Transactions:</span>
                      <span>2,456</span>
                    </div>
                    <div className={styles.dataRow}>
                      <span>24h Buyers:</span>
                      <span>892</span>
                    </div>
                    <div className={styles.dataRow}>
                      <span>24h Sellers:</span>
                      <span>567</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        <FooterBar onOpenSettings={() => setPresetModalOpen(true)} />

        <BuySellFilterPanel
          open={showFilters}
          onClose={() => setShowFilters(false)}
          userId={userId}
          buyFilters={buyFilters}
          sellFilters={sellFilters}
          onChangeBuyFilters={setBuyFilters}
          onChangeSellFilters={setSellFilters}
        />

        <DepositModal
          open={depositModalOpen}
          onClose={() => setDepositModalOpen(false)}
          walletAddress={walletAddress}
          solBalance={solBalance}
        />

        <WithdrawModal
          open={withdrawModalOpen}
          onClose={() => setWithdrawModalOpen(false)}
          walletAddress={walletAddress}
          solBalance={solBalance}
          onNotification={() => {}}
        />

        <PresetModal
          open={presetModalOpen}
          onClose={() => setPresetModalOpen(false)}
          buyPresets={buyPresets}
          sellPresets={sellPresets}
          activeBuyPreset={activeBuyPreset}
          activeSellPreset={activeSellPreset}
          setActiveBuyPreset={setActiveBuyPreset}
          setActiveSellPreset={setActiveSellPreset}
        />
      </div>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle className={styles.dialogTitle}>
        {token?.name || "Token Details"}
        <Button onClick={onClose} className={styles.closeButton}>
          ×
        </Button>
      </DialogTitle>
      <DialogContent className={styles.dialogContent}>
        <div className={styles.chartContainer}>
          <div
            id="tradingview_chart"
            ref={chartContainerRef}
            className={styles.chart}
          />
        </div>

        {token && (
          <div className={styles.tokenDetails}>
            <div className={styles.tokenHeader}>
              {token.imageUrl && (
                <img
                  src={token.imageUrl}
                  alt={token.name}
                  className={styles.tokenImage}
                />
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
              <p>
                <strong>Mint:</strong> {token.mint}
              </p>
              <p>
                <strong>Creator:</strong>{" "}
                {token.creator || token.devAddress || "Unknown"}
              </p>
              <p>
                <strong>Age:</strong>{" "}
                {Math.floor((Date.now() - token.creationTimestamp) / 60000)}m
              </p>
            </div>

            {token.balance && (
              <div className={styles.ownedSection}>
                <h3>Your Holdings</h3>
                <div className={styles.holdingsInfo}>
                  <p>
                    <strong>Balance:</strong> {token.balance} {token.symbol}
                  </p>
                  {token.buyAmount && (
                    <p>
                      <strong>Buy Price:</strong> ${token.buyAmount}
                    </p>
                  )}
                  {/* {token.buyTime && <p><strong>Bought:</strong> {new Date(token.buyTime).toLocaleString()}</p>} */}
                </div>
              </div>
            )}

            <div className={styles.autoSellSection}>
              <h3>Auto-Sell Settings</h3>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoSellEnabled}
                    onChange={() => onAutoSellToggle?.(token)}
                    color="primary"
                  />
                }
                label="Enable Auto-Sell"
                className={styles.autoSellToggle}
              />

              {autoSellEnabled && (
                <div className={styles.autoSellControls}>
                  <TextField
                    label="Take Profit %"
                    type="number"
                    value={takeProfit}
                    onChange={(e) => bind(onTakeProfitChange)(e.target.value)}
                    className={styles.input}
                    size="small"
                  />
                  <TextField
                    label="Stop Loss %"
                    type="number"
                    value={stopLoss}
                    onChange={(e) => bind(onStopLossChange)(e.target.value)}
                    className={styles.input}
                    size="small"
                  />
                  <TextField
                    label="Auto Sell %"
                    type="number"
                    value={autoSellPercent}
                    onChange={(e) =>
                      bind(onAutoSellPercentChange)(e.target.value)
                    }
                    className={styles.input}
                    size="small"
                  />

                  <div className={styles.controlRow}>
                    <TextField
                      label="Trailing Stop Loss (%)"
                      type="number"
                      value={trailingStopLoss}
                      onChange={(e) =>
                        bind(onTrailingStopLossChange)(e.target.value)
                      }
                      className={styles.input}
                      size="small"
                      disabled={
                        !trailingStopLossEnabled || timeBasedSellEnabled
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={trailingStopLossEnabled}
                          onChange={(e) =>
                            bind(onTrailingStopLossEnabledChange)(
                              e.target.checked
                            )
                          }
                          color="primary"
                          size="small"
                          disabled={timeBasedSellEnabled}
                        />
                      }
                      label="Enable Trailing"
                      className={styles.switchLabel}
                    />
                  </div>

                  <div className={styles.controlRow}>
                    <TextField
                      label="Time-Based Sell (sec)"
                      type="number"
                      value={timeBasedSell}
                      onChange={(e) =>
                        bind(onTimeBasedSellChange)(e.target.value)
                      }
                      className={styles.input}
                      size="small"
                      disabled={!timeBasedSellEnabled}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={timeBasedSellEnabled}
                          onChange={(e) =>
                            bind(onTimeBasedSellEnabledChange)(e.target.checked)
                          }
                          color="primary"
                          size="small"
                        />
                      }
                      label="Enable Time-Based"
                      className={styles.switchLabel}
                    />
                  </div>

                  <div className={styles.controlRow}>
                    <TextField
                      label="Wait for Buyers Before Sell"
                      type="number"
                      value={waitForBuyers}
                      onChange={(e) =>
                        bind(onWaitForBuyersChange)(e.target.value)
                      }
                      className={styles.input}
                      size="small"
                      disabled={!waitForBuyersEnabled}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={waitForBuyersEnabled}
                          onChange={(e) =>
                            bind(onWaitForBuyersEnabledChange)(e.target.checked)
                          }
                          color="primary"
                          size="small"
                        />
                      }
                      label="Enable Wait for Buyers"
                      className={styles.switchLabel}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <Button onClick={handleBuy} className={styles.buyButton}>
                Buy
              </Button>
              {token.balance && (
                <Button onClick={handleSell} className={styles.sellButton}>
                  Sell
                </Button>
              )}
              <Button
                onClick={() => setShowFilters(true)}
                className={styles.filtersButton}
              >
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

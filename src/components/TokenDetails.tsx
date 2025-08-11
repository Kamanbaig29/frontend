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
}

const TokenDetails: React.FC<TokenDetailsProps> = ({
  open,
  onClose,
  token,
  fullPage = false,
  solBalance: propSolBalance,
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
    setTransactionLoading,
  } = useWebSocket();
  const userId = localStorage.getItem("userId") || "default";
  const [solBalance, setSolBalance] = useState<number>(propSolBalance || 0);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [userTokens, setUserTokens] = useState<any[]>([]);
  const [buyAmount, setBuyAmount] = useState<string>("0.1");
  const [sellPercentage, setSellPercentage] = useState<string>("100");
  // const [activeFields, setActiveFields] = useState<string[]>(() => {
  //   const saved = localStorage.getItem(`activeFields_${token?.mint}`);
  //   return saved ? JSON.parse(saved) : [];
  // });
  const [notification, setNotification] = useState<{show: boolean, message: string}>({show: false, message: ''});
  const [errorNotification, setErrorNotification] = useState<{show: boolean, message: string}>({show: false, message: ''});
  // const [advancedSettingsEnabled, setAdvancedSettingsEnabled] = useState(false);

  useEffect(() => {
    if (!open || !token) return;

    const fetchUserData = async () => {
      try {
        const userId = localStorage.getItem("userId");
        if (!userId) return;

        // Fetch auto-sell configs like TokenListWithAge
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/auto-sell/user/${userId}`
        );
        
        if (response.ok) {
          const data = await response.json();
          const autoSellConfigs = data.autoSells || [];
          
          // Get wallet tokens via WebSocket
          if (ws) {
            ws.send(JSON.stringify({ type: "GET_USER_TOKENS" }));
            ws.send(JSON.stringify({ type: "GET_SOL_BALANCE" }));
            
            const handleMessage = (event: MessageEvent) => {
              const wsData = JSON.parse(event.data);
              if (wsData.type === "SOL_BALANCE_UPDATE") {
                setSolBalance(wsData.balance);
              } else if (wsData.type === "USER_TOKENS") {
                const walletTokens = wsData.tokens || [];
                
                // Merge like TokenListWithAge does
                const merged = walletTokens.map((walletToken: any) => {
                  const config = autoSellConfigs.find((c: any) => c.mint === walletToken.mint);
                  
                  // Update autoSellConfig if this is the current token
                  if (token && walletToken.mint === token.mint) {
                    if (config) {
                      setAutoSellConfig({
                        autoSellEnabled: config.autoSellEnabled ?? false,
                        takeProfit: config.takeProfit?.toString() ?? "10",
                        takeProfitEnabled: config.takeProfitEnabled ?? false,
                        stopLoss: config.stopLoss?.toString() ?? "10",
                        stopLossEnabled: config.stopLossEnabled ?? false,
                        autoSellPercent: config.autoSellPercent?.toString() ?? "100",
                        trailingStopLoss: config.trailingStopLossPercent?.toString() ?? "10",
                        trailingStopLossEnabled: config.trailingStopLossEnabled ?? false,
                        timeBasedSell: config.timeBasedSellSec?.toString() ?? "0",
                        timeBasedSellEnabled: config.timeBasedSellEnabled ?? false,
                        waitForBuyers: config.waitForBuyersBeforeSell?.toString() ?? "5",
                        waitForBuyersEnabled: config.waitForBuyersBeforeSellEnabled ?? false,
                      });
                    } else {
                      // No config exists, set default values
                      setAutoSellConfig({
                        autoSellEnabled: false,
                        takeProfit: "10",
                        takeProfitEnabled: false,
                        stopLoss: "10",
                        stopLossEnabled: false,
                        autoSellPercent: "100",
                        trailingStopLoss: "10",
                        trailingStopLossEnabled: false,
                        timeBasedSell: "0",
                        timeBasedSellEnabled: false,
                        waitForBuyers: "5",
                        waitForBuyersEnabled: false,
                      });
                    }
                  }
                  
                  return {
                    ...walletToken,
                    autoSellEnabled: config?.autoSellEnabled ?? false,
                    takeProfit: config?.takeProfit ?? walletToken.takeProfit ?? 10,
                    stopLoss: config?.stopLoss ?? walletToken.stopLoss ?? 10,
                    autoSellPercent: config?.autoSellPercent ?? walletToken.autoSellPercent ?? 100,
                  };
                });
                setUserTokens(merged);
              }
            };
            
            ws.addEventListener("message", handleMessage);
            return () => ws.removeEventListener("message", handleMessage);
          }
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      }
    };

    fetchUserData();
  }, [open, token, ws]);

  // Auto-sell state managed independently
  const [autoSellConfig, setAutoSellConfig] = useState({
    autoSellEnabled: false,
    takeProfit: "",
    takeProfitEnabled: false,
    stopLoss: "",
    stopLossEnabled: false,
    autoSellPercent: "100",
    trailingStopLoss: "",
    trailingStopLossEnabled: false,
    timeBasedSell: "",
    timeBasedSellEnabled: false,
    waitForBuyers: "",
    waitForBuyersEnabled: false,
  });

  // Auto-sell handlers
  const handleTakeProfitChange = (mint: string, value: string) => {
    setAutoSellConfig(prev => ({ ...prev, takeProfit: value }));
    if (autoSellConfig.autoSellEnabled) {
      updateAutoSellConfig(mint, { takeProfit: Number(value) || undefined });
    }
  };

  const handleStopLossChange = (mint: string, value: string) => {
    setAutoSellConfig(prev => ({ ...prev, stopLoss: value }));
    if (autoSellConfig.autoSellEnabled) {
      updateAutoSellConfig(mint, { stopLoss: Number(value) || undefined });
    }
  };

  const handleAutoSellPercentChange = (mint: string, value: string) => {
    setAutoSellConfig(prev => ({ ...prev, autoSellPercent: value }));
    if (autoSellConfig.autoSellEnabled) {
      updateAutoSellConfig(mint, { autoSellPercent: Number(value) || 100 });
    }
  };

  const handleAutoSellToggle = (token: Token) => {
    if (!walletAddress) {
      setTransactionLoading({ type: 'sell', message: '❌ Wallet address not loaded' });
      setTimeout(() => setTransactionLoading({ type: null, message: '' }), 2000);
      return;
    }
    const enabled = !autoSellConfig.autoSellEnabled;
    
    if (enabled) {
      // Set default values when enabling auto-sell
      const defaultConfig = {
        autoSellEnabled: true,
        takeProfit: "10",
        takeProfitEnabled: false,
        stopLoss: "10",
        stopLossEnabled: false,
        autoSellPercent: "100",
        trailingStopLoss: "10",
        trailingStopLossEnabled: false,
        timeBasedSell: "0",
        timeBasedSellEnabled: false,
        waitForBuyers: "5",
        waitForBuyersEnabled: false,
      };
      setAutoSellConfig(defaultConfig);
      updateAutoSellConfig(token.mint, { 
        autoSellEnabled: true,
        takeProfit: 10,
        takeProfitEnabled: false,
        stopLoss: 10,
        stopLossEnabled: false,
        autoSellPercent: 100,
        trailingStopLossPercent: 10,
        trailingStopLossEnabled: false,
        timeBasedSellSec: 0,
        timeBasedSellEnabled: false,
        waitForBuyersBeforeSell: 5,
        waitForBuyersBeforeSellEnabled: false,
      });
    } else {
      setAutoSellConfig(prev => ({ ...prev, autoSellEnabled: false }));
      updateAutoSellConfig(token.mint, { autoSellEnabled: false });
    }
  };

  const handleTrailingStopLossChange = (mint: string, value: string) => {
    setAutoSellConfig(prev => ({ ...prev, trailingStopLoss: value }));
    if (autoSellConfig.autoSellEnabled) {
      updateAutoSellConfig(mint, { trailingStopLossPercent: Number(value) || 10 });
    }
  };

  const handleTrailingStopLossEnabledChange = (mint: string, checked: boolean) => {
    setAutoSellConfig(prev => ({ ...prev, trailingStopLossEnabled: checked }));
    if (autoSellConfig.autoSellEnabled) {
      updateAutoSellConfig(mint, { trailingStopLossEnabled: checked });
    }
  };

  const handleTimeBasedSellChange = (mint: string, value: string) => {
    setAutoSellConfig(prev => ({ ...prev, timeBasedSell: value }));
    if (autoSellConfig.autoSellEnabled) {
      updateAutoSellConfig(mint, { timeBasedSellSec: Number(value) || 0 });
    }
  };

  const handleTimeBasedSellEnabledChange = (mint: string, checked: boolean) => {
    setAutoSellConfig(prev => ({ ...prev, timeBasedSellEnabled: checked }));
    if (autoSellConfig.autoSellEnabled) {
      updateAutoSellConfig(mint, { timeBasedSellEnabled: checked });
    }
  };

  const handleWaitForBuyersChange = (mint: string, value: string) => {
    setAutoSellConfig(prev => ({ ...prev, waitForBuyers: value }));
    if (autoSellConfig.autoSellEnabled) {
      updateAutoSellConfig(mint, { waitForBuyersBeforeSell: Number(value) || 5 });
    }
  };

  const handleWaitForBuyersEnabledChange = (mint: string, checked: boolean) => {
    setAutoSellConfig(prev => ({ ...prev, waitForBuyersEnabled: checked }));
    if (autoSellConfig.autoSellEnabled) {
      updateAutoSellConfig(mint, { waitForBuyersBeforeSellEnabled: checked });
    }
  };

  const updateAutoSellConfig = async (mint: string, updates: any) => {
    if (!walletAddress) return;
    
    const preset = sellPresets[activeSellPreset] || {};
    const payload = {
      userId,
      walletAddress,
      mint,
      buyPrice: userToken?.buyAmount || 0,
      takeProfit: Number(autoSellConfig.takeProfit) || undefined,
      takeProfitEnabled: autoSellConfig.takeProfitEnabled,
      stopLoss: Number(autoSellConfig.stopLoss) || undefined,
      stopLossEnabled: autoSellConfig.stopLossEnabled,
      autoSellPercent: Number(autoSellConfig.autoSellPercent) || 100,
      autoSellEnabled: autoSellConfig.autoSellEnabled,
      slippage: preset.slippage || 5,
      priorityFee: preset.priorityFee || 0.001,
      bribeAmount: preset.bribeAmount || 0,
      tokenName: token?.name,
      tokenSymbol: token?.symbol,
      trailingStopLossPercent: Number(autoSellConfig.trailingStopLoss) || 10,
      trailingStopLossEnabled: autoSellConfig.trailingStopLossEnabled,
      timeBasedSellSec: Number(autoSellConfig.timeBasedSell) || 0,
      timeBasedSellEnabled: autoSellConfig.timeBasedSellEnabled,
      waitForBuyersBeforeSell: Number(autoSellConfig.waitForBuyers) || 5,
      waitForBuyersBeforeSellEnabled: autoSellConfig.waitForBuyersEnabled,
      ...updates
    };
    
    const API_URL = import.meta.env.VITE_API_BASE_URL;
    try {
      await fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to update auto-sell config:", error);
    }
  };
  // Get user's balance for this token from userTokens array
  const userToken = token
    ? userTokens.find((t) => t.mint === token.mint)
    : null;
  const userBalance = userToken?.balance || token?.balance || 0;
  // const hasBalance = userBalance > 0;

  // Debug logging
  // console.log("TokenDetails Debug:", {
  //   tokenMint: token?.mint,
  //   userTokensLength: userTokens.length,
  //   userToken,
  //   userBalance,
  //   tokenBalance: token?.balance,
  // });

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
      try {
        if (widgetRef.current) {
          widgetRef.current.remove();
        }
        
        const container = document.getElementById("tradingview_chart");
        if (!container) return;

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
      } catch (error) {
        console.error('TradingView widget error:', error);
      }
    };

    loadTradingView();

    return () => {
      try {
        if (widgetRef.current) {
          widgetRef.current.remove();
          widgetRef.current = null;
        }
      } catch (error) {
        console.error('TradingView cleanup error:', error);
      }
    };
  }, [open]);



  const handleBuy = () => {
    if (!ws || !token) return;

    const preset = buyPresets[activeBuyPreset] || {};
    const amountLamports = Math.floor(Number(buyAmount) * 1e9);
    const toLamports = (val: string) => Math.floor(Number(val) * 1e9);

    setTransactionLoading({ type: 'buy', message: 'Buy transaction sending...' });

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

  // Helper function for binding handlers
  const bindHandler = (handler: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => handler(e.target.value);
  const bindToggleHandler = (handler: (checked: boolean) => void) => (e: React.ChangeEvent<HTMLInputElement>) => handler(e.target.checked);

  // const addFieldToActive = (fieldName: string) => {
  //   if (!activeFields.includes(fieldName)) {
  //     const newFields = [...activeFields, fieldName];
  //     setActiveFields(newFields);
  //     if (token) localStorage.setItem(`activeFields_${token.mint}`, JSON.stringify(newFields));
  //   }
  // };

  // const removeFieldFromActive = (fieldName: string) => {
  //   const newFields = activeFields.filter(f => f !== fieldName);
  //   setActiveFields(newFields);
  //   if (token) localStorage.setItem(`activeFields_${token.mint}`, JSON.stringify(newFields));
  // };

  const showNotification = (message: string) => {
    setNotification({show: true, message});
    setTimeout(() => setNotification({show: false, message: ''}), 2000);
  };

  const showErrorNotification = (message: string) => {
    setErrorNotification({show: true, message});
    setTimeout(() => setErrorNotification({show: false, message: ''}), 3000);
  };

  const handleSell = () => {
    if (!ws || !token) return;

    const preset = sellPresets[activeSellPreset] || {};
    const sellPercent = Number(sellPercentage);
    
    setTransactionLoading({ type: 'sell', message: 'Sell transaction sending...' });
    
    ws.send(
      JSON.stringify({
        type: "MANUAL_SELL",
        mintAddress: token.mint,
        percent: sellPercent,
        sellAll: sellPercent === 100,
        slippage: preset.slippage,
        priorityFee: Number(preset.priorityFee),
        bribeAmount: Number(preset.bribeAmount),
        walletAddress,
      })
    );
  };

  if (fullPage) {
    if (!token) {
      return null;
    }
    
    return (
      <div className={styles.pageContainer}>
        <Navbar
          showMyTokens={localStorage.getItem('currentView') === 'portfolio'}
          onMyTokensClick={onClose}
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
              {/* Back Button */}
              <div className={styles.backButtonContainer}>
                <button 
                  className={styles.backButton}
                  onClick={onClose}
                >
                  ← Back
                </button>
              </div>

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
                          onClick={() => {
                            navigator.clipboard.writeText(token.mint);
                            showNotification('Mint address copied!');
                          }}
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
                          onClick={() => {
                            navigator.clipboard.writeText(
                              token.creator || token.devAddress || ""
                            );
                            showNotification('Creator address copied!');
                          }}
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
                      <span className={styles.statLabel}>Total Supply:</span>
                      <span className={styles.statValue}>1,000,000,000</span>
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
                          {/* <div className={styles.advancedSettingsCheckbox} onClick={() => setShowFilters(true)}>
                            <div className={`${styles.checkbox} ${styles.checked}`}>
                              <div className={styles.checkboxInner}></div>
                            </div>
                            <span className={styles.checkboxLabel}>Advanced Settings</span>
                          </div> */}

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
                          {userBalance > 0 && (
                            <div className={styles.ownedSection}>
                              <h3>Your Holdings</h3>
                              <div className={styles.holdingsInfo}>
                                <p>
                                  <strong>Balance:</strong> {userBalance}{" "}
                                  {token.symbol}
                                </p>
                                {userToken?.buyAmount && (
                                  <p>
                                    <strong>Buy Price:</strong> $
                                    {userToken.buyAmount}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          

                          <TextField
                            label="Sell Percentage (%)"
                            type="number"
                            value={sellPercentage}
                            onChange={(e) => setSellPercentage(e.target.value)}
                            className={styles.amountInput}
                            size="small"
                            sx={{
                              width: '100%',
                              "& .MuiOutlinedInput-root": {
                                backgroundColor: "#2a2a2a",
                                color: "#ffffff",
                                "& fieldset": {
                                  borderColor: "#444",
                                },
                                "&:hover fieldset": {
                                  borderColor: "#666",
                                },
                                "&.Mui-focused fieldset": {
                                  borderColor: "#ff4757",
                                },
                              },
                              "& .MuiInputLabel-root": {
                                color: "#aaa",
                                "&.Mui-focused": {
                                  color: "#ff4757",
                                },
                              },
                            }}
                          />
                          <Button
                            onClick={() => handleSell()}
                            className={styles.sellButton}
                            fullWidth
                            variant="contained"
                            disabled={!userBalance || userBalance <= 0}
                            sx={{
                              backgroundColor: userBalance > 0 ? "#ff4757" : "#666",
                              color: "#fff",
                              fontWeight: "bold",
                              fontSize: "16px",
                              padding: "12px",
                              borderRadius: "8px",
                              textTransform: "none",
                              "&:hover": {
                                backgroundColor: userBalance > 0 ? "#ff3742" : "#666",
                              },
                            }}
                          >
                            {userBalance > 0 ? `Sell ${sellPercentage}% ${token.symbol}` : "No Balance to Sell"}
                          </Button>
                          <div className={styles.autoSellCheckbox} onClick={() => token && handleAutoSellToggle(token)}>
                            <div className={`${styles.checkbox} ${autoSellConfig.autoSellEnabled ? styles.checked : ''}`}>
                              <div className={styles.checkboxInner}></div>
                            </div>
                            <span className={styles.checkboxLabel}>Auto Sell</span>
                          </div>
                          
                          {/* Auto Sell % - Always visible when auto-sell is enabled */}
                          {autoSellConfig.autoSellEnabled && (
                            <TextField
                              label="Auto Sell %"
                              type="number"
                              value={autoSellConfig.autoSellPercent}
                              onChange={(e) => handleAutoSellPercentChange(token.mint, e.target.value)}
                              size="small"
                              sx={{
                                width: '100%',
                                marginBottom: '12px',
                                "& .MuiOutlinedInput-root": {
                                  backgroundColor: "#2a2a2a",
                                  color: "#ffffff",
                                  "& fieldset": { borderColor: "#444" },
                                  "&:hover fieldset": { borderColor: "#666" },
                                  "&.Mui-focused fieldset": { borderColor: "#ff4757" },
                                },
                                "& .MuiInputLabel-root": {
                                  color: "#aaa",
                                  "&.Mui-focused": { color: "#ff4757" },
                                },
                              }}
                            />
                          )}
                          
                          {/* Disclaimer when all filters are disabled */}
                          {autoSellConfig.autoSellEnabled && 
                           !autoSellConfig.takeProfitEnabled && 
                           !autoSellConfig.stopLossEnabled && 
                           !autoSellConfig.trailingStopLossEnabled && 
                           !autoSellConfig.timeBasedSellEnabled && 
                           !autoSellConfig.waitForBuyersEnabled && (
                            <div className={styles.disclaimerMessage}>
                              ⚠️ No sell will be executed because no filter triggers are enabled. Please add at least one trigger below.
                            </div>
                          )}
                          
                          {/* Active Fields Outside Dropdown - Show enabled fields */}
                          {autoSellConfig.takeProfitEnabled && (
                            <div className={styles.activeField}>
                              <TextField
                                label="Take Profit %"
                                type="number"
                                value={autoSellConfig.takeProfit}
                                onChange={(e) => handleTakeProfitChange(token.mint, e.target.value)}
                                size="small"
                                sx={{
                                  width: '100%',
                                  "& .MuiOutlinedInput-root": {
                                    backgroundColor: "#2a2a2a",
                                    color: "#ffffff",
                                    "& fieldset": { borderColor: "#444" },
                                    "&:hover fieldset": { borderColor: "#666" },
                                    "&.Mui-focused fieldset": { borderColor: "#ff4757" },
                                  },
                                  "& .MuiInputLabel-root": {
                                    color: "#aaa",
                                    "&.Mui-focused": { color: "#ff4757" },
                                  },
                                }}
                              />
                              <button 
                                className={styles.removeFieldButton}
                                onClick={() => {
                                  setAutoSellConfig(prev => ({ ...prev, takeProfitEnabled: false }));
                                  if (token) updateAutoSellConfig(token.mint, { takeProfitEnabled: false });
                                }}
                              >
                                -
                              </button>
                            </div>
                          )}
                          
                          {autoSellConfig.stopLossEnabled && (
                            <div className={styles.activeField}>
                              <TextField
                                label="Stop Loss %"
                                type="number"
                                value={autoSellConfig.stopLoss}
                                onChange={(e) => handleStopLossChange(token.mint, e.target.value)}
                                size="small"
                                sx={{
                                  width: '100%',
                                  "& .MuiOutlinedInput-root": {
                                    backgroundColor: "#2a2a2a",
                                    color: "#ffffff",
                                    "& fieldset": { borderColor: "#444" },
                                    "&:hover fieldset": { borderColor: "#666" },
                                    "&.Mui-focused fieldset": { borderColor: "#ff4757" },
                                  },
                                  "& .MuiInputLabel-root": {
                                    color: "#aaa",
                                    "&.Mui-focused": { color: "#ff4757" },
                                  },
                                }}
                              />
                              <button 
                                className={styles.removeFieldButton}
                                onClick={() => {
                                  setAutoSellConfig(prev => ({ ...prev, stopLossEnabled: false }));
                                  if (token) updateAutoSellConfig(token.mint, { stopLossEnabled: false });
                                }}
                              >
                                -
                              </button>
                            </div>
                          )}
                          
                          {autoSellConfig.trailingStopLossEnabled && (
                            <div className={styles.activeField}>
                              <TextField
                                label="Trailing Stop Loss (%)"
                                type="number"
                                value={autoSellConfig.trailingStopLoss}
                                onChange={(e) => handleTrailingStopLossChange(token.mint, e.target.value)}
                                size="small"
                                sx={{
                                  width: '100%',
                                  "& .MuiOutlinedInput-root": {
                                    backgroundColor: "#2a2a2a",
                                    color: "#ffffff",
                                    "& fieldset": { borderColor: "#444" },
                                    "&:hover fieldset": { borderColor: "#666" },
                                    "&.Mui-focused fieldset": { borderColor: "#ff4757" },
                                  },
                                  "& .MuiInputLabel-root": {
                                    color: "#aaa",
                                    "&.Mui-focused": { color: "#ff4757" },
                                  },
                                }}
                              />
                              <button 
                                className={styles.removeFieldButton}
                                onClick={() => {
                                  setAutoSellConfig(prev => ({ ...prev, trailingStopLossEnabled: false }));
                                  if (token) updateAutoSellConfig(token.mint, { trailingStopLossEnabled: false });
                                }}
                              >
                                -
                              </button>
                            </div>
                          )}
                          
                          {autoSellConfig.timeBasedSellEnabled && (
                            <div className={styles.activeField}>
                              <TextField
                                label="Time-Based Sell (sec)"
                                type="number"
                                value={autoSellConfig.timeBasedSell}
                                onChange={(e) => handleTimeBasedSellChange(token.mint, e.target.value)}
                                size="small"
                                sx={{
                                  width: '100%',
                                  "& .MuiOutlinedInput-root": {
                                    backgroundColor: "#2a2a2a",
                                    color: "#ffffff",
                                    "& fieldset": { borderColor: "#444" },
                                    "&:hover fieldset": { borderColor: "#666" },
                                    "&.Mui-focused fieldset": { borderColor: "#ff4757" },
                                  },
                                  "& .MuiInputLabel-root": {
                                    color: "#aaa",
                                    "&.Mui-focused": { color: "#ff4757" },
                                  },
                                }}
                              />
                              <button 
                                className={styles.removeFieldButton}
                                onClick={() => {
                                  setAutoSellConfig(prev => ({ ...prev, timeBasedSellEnabled: false }));
                                  if (token) updateAutoSellConfig(token.mint, { timeBasedSellEnabled: false });
                                }}
                              >
                                -
                              </button>
                            </div>
                          )}
                          
                          {autoSellConfig.waitForBuyersEnabled && (
                            <div className={styles.activeField}>
                              <TextField
                                label="Wait for Buyers Before Sell"
                                type="number"
                                value={autoSellConfig.waitForBuyers}
                                onChange={(e) => handleWaitForBuyersChange(token.mint, e.target.value)}
                                size="small"
                                sx={{
                                  width: '100%',
                                  "& .MuiOutlinedInput-root": {
                                    backgroundColor: "#2a2a2a",
                                    color: "#ffffff",
                                    "& fieldset": { borderColor: "#444" },
                                    "&:hover fieldset": { borderColor: "#666" },
                                    "&.Mui-focused fieldset": { borderColor: "#ff4757" },
                                  },
                                  "& .MuiInputLabel-root": {
                                    color: "#aaa",
                                    "&.Mui-focused": { color: "#ff4757" },
                                  },
                                }}
                              />
                              <button 
                                className={styles.removeFieldButton}
                                onClick={() => {
                                  setAutoSellConfig(prev => ({ ...prev, waitForBuyersEnabled: false }));
                                  if (token) updateAutoSellConfig(token.mint, { waitForBuyersBeforeSellEnabled: false });
                                }}
                              >
                                -
                              </button>
                            </div>
                          )}
                          {/* {false && activeFields.map(fieldName => {
                            // const fieldConfig = {
                            //   'takeProfit': { label: 'Take Profit %', value: autoSellConfig.takeProfit, onChange: (v: string) => handleTakeProfitChange(token.mint, v) },
                            //   'stopLoss': { label: 'Stop Loss %', value: autoSellConfig.stopLoss, onChange: (v: string) => handleStopLossChange(token.mint, v) },

                            //   'trailingStopLoss': { label: 'Trailing Stop Loss (%)', value: autoSellConfig.trailingStopLoss, onChange: (v: string) => handleTrailingStopLossChange(token.mint, v) },
                            //   'timeBasedSell': { label: 'Time-Based Sell (sec)', value: autoSellConfig.timeBasedSell, onChange: (v: string) => handleTimeBasedSellChange(token.mint, v) },
                            //   'waitForBuyers': { label: 'Wait for Buyers Before Sell', value: autoSellConfig.waitForBuyers, onChange: (v: string) => handleWaitForBuyersChange(token.mint, v) }
                            // }[fieldName];
                            
                            return null;
                          })} */}
                          
                          {autoSellConfig.autoSellEnabled && (
                            <div className={styles.addFieldsDropdown}>
                              <button className={styles.addButton}>+ Add</button>
                              <div className={styles.dropdownContent}>
                                {!autoSellConfig.takeProfitEnabled && (
                                  <div className={styles.dropdownField}>
                                    <TextField
                                      label="Take Profit %"
                                      type="number"
                                      value={autoSellConfig.takeProfit}
                                      disabled
                                      size="small"
                                      sx={{
                                        width: 'calc(100% - 30px)',
                                        "& .MuiOutlinedInput-root": {
                                          backgroundColor: "#2a2a2a",
                                          color: "#ffffff",
                                          "& fieldset": { borderColor: "#444" },
                                          "&:hover fieldset": { borderColor: "#666" },
                                          "&.Mui-focused fieldset": { borderColor: "#ff4757" },
                                        },
                                        "& .MuiInputLabel-root": {
                                          color: "#aaa",
                                          "&.Mui-focused": { color: "#ff4757" },
                                        },
                                      }}
                                    />
                                    <button 
                                      className={styles.addFieldButton}
                                      onClick={() => {
                                        setAutoSellConfig(prev => ({ ...prev, takeProfitEnabled: true }));
                                        if (token) updateAutoSellConfig(token.mint, { takeProfitEnabled: true });
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                                {!autoSellConfig.stopLossEnabled && (
                                  <div className={styles.dropdownField}>
                                    <TextField
                                      label="Stop Loss %"
                                      type="number"
                                      value={autoSellConfig.stopLoss}
                                      disabled
                                      size="small"
                                      sx={{
                                        width: 'calc(100% - 30px)',
                                        "& .MuiOutlinedInput-root": {
                                          backgroundColor: "#2a2a2a",
                                          color: "#ffffff",
                                          "& fieldset": { borderColor: "#444" },
                                          "&:hover fieldset": { borderColor: "#666" },
                                          "&.Mui-focused fieldset": { borderColor: "#ff4757" },
                                        },
                                        "& .MuiInputLabel-root": {
                                          color: "#aaa",
                                          "&.Mui-focused": { color: "#ff4757" },
                                        },
                                      }}
                                    />
                                    <button 
                                      className={styles.addFieldButton}
                                      onClick={() => {
                                        if (autoSellConfig.trailingStopLossEnabled) {
                                          showErrorNotification('One loss filter already active. Disable Trailing Stop Loss first then add Stop Loss.');
                                          return;
                                        }
                                        setAutoSellConfig(prev => ({ ...prev, stopLossEnabled: true }));
                                        if (token) updateAutoSellConfig(token.mint, { stopLossEnabled: true });
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                )}

                                {!autoSellConfig.trailingStopLossEnabled && (
                                  <div className={styles.dropdownField}>
                                    <TextField
                                      label="Trailing Stop Loss (%)"
                                      type="number"
                                      value={autoSellConfig.trailingStopLoss}
                                      disabled
                                      size="small"
                                      sx={{
                                        width: 'calc(100% - 30px)',
                                        "& .MuiOutlinedInput-root": {
                                          backgroundColor: "#2a2a2a",
                                          color: "#ffffff",
                                          "& fieldset": { borderColor: "#444" },
                                          "&:hover fieldset": { borderColor: "#666" },
                                          "&.Mui-focused fieldset": { borderColor: "#ff4757" },
                                        },
                                        "& .MuiInputLabel-root": {
                                          color: "#aaa",
                                          "&.Mui-focused": { color: "#ff4757" },
                                        },
                                      }}
                                    />
                                    <button 
                                      className={styles.addFieldButton}
                                      onClick={() => {
                                        if (autoSellConfig.stopLossEnabled) {
                                          showErrorNotification('One loss filter already active. Disable Stop Loss first then add Trailing Stop Loss.');
                                          return;
                                        }
                                        setAutoSellConfig(prev => ({ ...prev, trailingStopLossEnabled: true }));
                                        if (token) updateAutoSellConfig(token.mint, { trailingStopLossEnabled: true });
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                                {!autoSellConfig.timeBasedSellEnabled && (
                                  <div className={styles.dropdownField}>
                                    <TextField
                                      label="Time-Based Sell (sec)"
                                      type="number"
                                      value={autoSellConfig.timeBasedSell}
                                      disabled
                                      size="small"
                                      sx={{
                                        width: 'calc(100% - 30px)',
                                        "& .MuiOutlinedInput-root": {
                                          backgroundColor: "#2a2a2a",
                                          color: "#ffffff",
                                          "& fieldset": { borderColor: "#444" },
                                          "&:hover fieldset": { borderColor: "#666" },
                                          "&.Mui-focused fieldset": { borderColor: "#ff4757" },
                                        },
                                        "& .MuiInputLabel-root": {
                                          color: "#aaa",
                                          "&.Mui-focused": { color: "#ff4757" },
                                        },
                                      }}
                                    />
                                    <button 
                                      className={styles.addFieldButton}
                                      onClick={() => {
                                        setAutoSellConfig(prev => ({ ...prev, timeBasedSellEnabled: true }));
                                        if (token) updateAutoSellConfig(token.mint, { timeBasedSellEnabled: true });
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                                {!autoSellConfig.waitForBuyersEnabled && (
                                  <div className={styles.dropdownField}>
                                    <TextField
                                      label="Wait for Buyers Before Sell"
                                      type="number"
                                      value={autoSellConfig.waitForBuyers}
                                      disabled
                                      size="small"
                                      sx={{
                                        width: 'calc(100% - 30px)',
                                        "& .MuiOutlinedInput-root": {
                                          backgroundColor: "#2a2a2a",
                                          color: "#ffffff",
                                          "& fieldset": { borderColor: "#444" },
                                          "&:hover fieldset": { borderColor: "#666" },
                                          "&.Mui-focused fieldset": { borderColor: "#ff4757" },
                                        },
                                        "& .MuiInputLabel-root": {
                                          color: "#aaa",
                                          "&.Mui-focused": { color: "#ff4757" },
                                        },
                                      }}
                                    />
                                    <button 
                                      className={styles.addFieldButton}
                                      onClick={() => {
                                        setAutoSellConfig(prev => ({ ...prev, waitForBuyersEnabled: true }));
                                        if (token) updateAutoSellConfig(token.mint, { waitForBuyersBeforeSellEnabled: true });
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              

              {/* Bottom Data Section */}
              <div className={styles.dataSection}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Token Analytics</h2>
                  <div className={styles.sectionSubtitle}>Real-time market data and statistics</div>
                </div>
                <div className={styles.dataGrid}>
                  <div className={styles.modernDataCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardIcon}><img src="/tokenDetail/group.png" alt="" width={30} height={30} /></div>
                      <h3 className={styles.cardTitle}>Holders</h3>
                    </div>
                    <div className={styles.cardContent}>
                      <div className={styles.modernDataRow}>
                        <div className={styles.dataLabel}>Total Holders</div>
                        <div className={styles.dataValue}>1,234</div>
                      </div>
                      <div className={styles.modernDataRow}>
                        <div className={styles.dataLabel}>Top 10 Holdings</div>
                        <div className={styles.dataValue}>45.2%</div>
                      </div>
                      <div className={styles.modernDataRow}>
                        <div className={styles.dataLabel}>Liquidity Pool</div>
                        <div className={styles.dataValue}>$125K</div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.modernDataCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardIcon}><img src="/tokenDetail/candlestick-chart.png" alt="" width={30} height={30} /></div>
                      <h3 className={styles.cardTitle}>Trading Stats</h3>
                    </div>
                    <div className={styles.cardContent}>
                      <div className={styles.modernDataRow}>
                        <div className={styles.dataLabel}>24h Transactions</div>
                        <div className={styles.dataValue}>2,456</div>
                      </div>
                      <div className={styles.modernDataRow}>
                        <div className={styles.dataLabel}>24h Buyers</div>
                        <div className={styles.dataValue + ' ' + styles.positive}>892</div>
                      </div>
                      <div className={styles.modernDataRow}>
                        <div className={styles.dataLabel}>24h Sellers</div>
                        <div className={styles.dataValue + ' ' + styles.negative}>567</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.modernDataCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardIcon}><img src="/tokenDetail/money.png" alt="" width={30} height={30} /></div>
                      <h3 className={styles.cardTitle}>Market Data</h3>
                    </div>
                    <div className={styles.cardContent}>
                      <div className={styles.modernDataRow}>
                        <div className={styles.dataLabel}>Market Cap</div>
                        <div className={styles.dataValue}>$2.4M</div>
                      </div>
                      <div className={styles.modernDataRow}>
                        <div className={styles.dataLabel}>24h Volume</div>
                        <div className={styles.dataValue}>$456K</div>
                      </div>
                      <div className={styles.modernDataRow}>
                        <div className={styles.dataLabel}>Price Change</div>
                        <div className={styles.dataValue + ' ' + styles.positive}>+12.5%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        <FooterBar onOpenSettings={() => setPresetModalOpen(true)} />

        {/* Copy Notification */}
        {notification.show && (
          <div className={styles.copyNotification}>
            {notification.message}
          </div>
        )}

        {/* Error Notification */}
        {errorNotification.show && (
          <div className={styles.errorNotification}>
            {errorNotification.message}
          </div>
        )}

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
                    checked={autoSellConfig.autoSellEnabled}
                    onChange={() => token && handleAutoSellToggle(token)}
                    color="primary"
                  />
                }
                label="Enable Auto-Sell"
                className={styles.autoSellToggle}
              />

              {autoSellConfig.autoSellEnabled && (
                <div className={styles.autoSellControls}>
                  <TextField
                    label="Take Profit %"
                    type="number"
                    value={autoSellConfig.takeProfit}
                    onChange={bindHandler((v) => handleTakeProfitChange(token.mint, v))}
                    className={styles.input}
                    size="small"
                  />
                  <TextField
                    label="Stop Loss %"
                    type="number"
                    value={autoSellConfig.stopLoss}
                    onChange={bindHandler((v) => handleStopLossChange(token.mint, v))}
                    className={styles.input}
                    size="small"
                  />
                  <TextField
                    label="Auto Sell %"
                    type="number"
                    value={autoSellConfig.autoSellPercent}
                    onChange={bindHandler((v) => handleAutoSellPercentChange(token.mint, v))}
                    className={styles.input}
                    size="small"
                  />

                  <div className={styles.controlRow}>
                    <TextField
                      label="Trailing Stop Loss (%)"
                      type="number"
                      value={autoSellConfig.trailingStopLoss}
                      onChange={bindHandler((v) => handleTrailingStopLossChange(token.mint, v))}
                      className={styles.input}
                      size="small"
                      disabled={!autoSellConfig.trailingStopLossEnabled || autoSellConfig.timeBasedSellEnabled}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoSellConfig.trailingStopLossEnabled}
                          onChange={bindToggleHandler((c) => handleTrailingStopLossEnabledChange(token.mint, c))}
                          color="primary"
                          size="small"
                          disabled={autoSellConfig.timeBasedSellEnabled}
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
                      value={autoSellConfig.timeBasedSell}
                      onChange={bindHandler((v) => handleTimeBasedSellChange(token.mint, v))}
                      className={styles.input}
                      size="small"
                      disabled={!autoSellConfig.timeBasedSellEnabled}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoSellConfig.timeBasedSellEnabled}
                          onChange={bindToggleHandler((c) => handleTimeBasedSellEnabledChange(token.mint, c))}
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
                      value={autoSellConfig.waitForBuyers}
                      onChange={bindHandler((v) => handleWaitForBuyersChange(token.mint, v))}
                      className={styles.input}
                      size="small"
                      disabled={!autoSellConfig.waitForBuyersEnabled}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoSellConfig.waitForBuyersEnabled}
                          onChange={bindToggleHandler((c) => handleWaitForBuyersEnabledChange(token.mint, c))}
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
              <Button 
                onClick={handleSell} 
                className={styles.sellButton}
                disabled={!userBalance || userBalance <= 0}
              >
                {userBalance > 0 ? `Sell ${sellPercentage}%` : "No Balance"}
              </Button>
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

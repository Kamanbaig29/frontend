import React, { useEffect, useState, useRef } from "react";
import {
  Button,
  // TextField,
  // Switch,
  // FormControlLabel,
} from "@mui/material";

import PresetModal from "./PresetModal";
import { useWebSocket } from "../context/webSocketContext";
import BuySellFilterPanel, {
  type BuyFilters,
  type SellFilters,
} from "./BuySellFilterPanel";
import TokenDetails from "./TokenDetails";
import Navbar from "./Navbar";
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";
import FooterBar from "./FooterBar";
import styles from "../assets/TokenListWithAge.module.css";
import HomeSetting from "./homeSetting";
import SectionFilters from "./sectionFilters";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faGlobe,
  faPills,
  faMagnifyingGlass,
  faUserTie,
  faBolt,
  faCopy,
  faUsers,
  faArrowUp,
  faArrowDown,
} from "@fortawesome/free-solid-svg-icons";

import { faTelegram } from "@fortawesome/free-brands-svg-icons";

// import { faUsers } from "@fortawesome/free-solid-svg-icons";
// import { faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";

// import PersonIcon from "/public/tokenCardIcons/person.svg";
// import { ReactComponent as PersonIcon } from "/public/tokenCardIcons/person.svg";

//import { WebSocketContext } from "../context/webSocketContext";

type Token = {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  creationTimestamp: number;
  currentPrice?: number;
  // Add more fields if you want to display them
  buyAmount?: number;
  balance?: number;
  lastUpdated?: string | number | Date;
  autoSellEnabled?: boolean; // Added for backend sync
  takeProfit?: number; // Added for backend sync
  stopLoss?: number; // Added for backend sync
  autoSellPercent?: number; // Added for backend sync
  decimals?: number; // Added for backend sync
  devAddress?: string; // Added for whitelist/blacklist
  owner?: string; // Added for owner
  creator?: string;
  trailingStopLossPercent?: number; // Added for backend sync
  trailingStopLossEnabled?: boolean; // Added for backend sync
  timeBasedSellSec?: number; // Added for backend sync
  timeBasedSellEnabled?: boolean; // Added for backend sync
  waitForBuyersBeforeSell?: number; // Added for backend sync
  waitForBuyersBeforeSellEnabled?: boolean; // Added for backend sync
  buyTime?: number; // Added for backend sync
  // PumpFun specific fields
  marketCap?: number;
  volume?: number;
  holders?: number;
  buys?: number;
  sells?: number;
  bondingCurveProgress?: number;
  website?: string;
  twitter?: string;
  telegram?: string;
  pumpLink?: string;
};

function getAgeString(ageMs: number): string {
  const totalSeconds = Math.floor(ageMs / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return `${totalHours}h`;
  }

  const totalDays = Math.floor(totalHours / 24);
  return `${totalDays}d`;
}

function toFullDecimalString(num: number): string {
  if (num === 0) return "0";
  // Get fixed with high precision, then trim unnecessary zeros
  return num.toFixed(20).replace(/\.?0+$/, "");
}

function formatPriceSmart(price: number): string {
  if (price === 0) return "0";
  if (price < 0.009) return price.toExponential(2); // e.g. 2.84e-8
  return price.toFixed(6); // e.g. 0.012300
}

// function formatTokenBalance(balance: number, symbol: string) {
//   console.log("[DEBUG] formatTokenBalance input:", balance, symbol);
//   if (balance >= 1_000_000) {
//     console.log("[DEBUG] Balance M:", balance / 1_000_000);
//     return `${(balance / 1_000_000).toFixed(2)}M ${symbol}`;
//   }
//   if (balance >= 1_000) {
//     console.log("[DEBUG] Balance K:", balance / 1_000);
//     return `${(balance / 1_000).toFixed(2)}K ${symbol}`;
//   }
//   console.log("[DEBUG] Balance:", balance);
//   return `${balance} ${symbol}`;
// }

// const sellPercents = [10, 30, 50, 100];

const TokenListWithAge: React.FC = () => {
  // All useState, useEffect, useRef, etc. go here
  const [tokens, setTokens] = useState<Token[]>([]);
  const [now, setNow] = useState(Date.now());
  const [, setLoading] = useState(true);
  const [, setError] = useState("");
  const [sortOrder] = useState<"desc" | "asc">("desc"); // 'desc' = newest first
  const [presetModalOpen, setPresetModalOpen] = useState(false);

  const [showMyTokens, setShowMyTokens] = useState(() => {
    const savedView = localStorage.getItem("currentView");
    return savedView === "portfolio";
  });
  const [walletTokens, setWalletTokens] = useState<Token[]>([]);
  const [autoSellConfigs, setAutoSellConfigs] = useState<any[]>([]);
  const [userTokens, setUserTokens] = useState<Token[]>([]);
  const [, /*sellPercentsState*/ setSellPercentsState] = useState<{
    [key: string]: number;
  }>({});
  const [autoBuyEnabled, setAutoBuyEnabled] = useState(false);
  const [bufferAmount, setBufferAmount] = useState<string>("");
  const [, setAutoBuySnackbar] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: "" });
  const [lastAutoBuyMint, setLastAutoBuyMint] = useState<string | null>(null);
  const [takeProfitState, setTakeProfitState] = useState<{
    [key: string]: string;
  }>({});
  const [stopLossState, setStopLossState] = useState<{ [key: string]: string }>(
    {}
  );
  const [autoSellPercentState, setAutoSellPercentState] = useState<{
    [key: string]: string;
  }>({});
  const [autoSellEnabledState, setAutoSellEnabledState] = useState<{
    [key: string]: boolean;
  }>({});
  const [showFilters, setShowFilters] = useState(false);
  const [buyFilters, setBuyFilters] = useState<{
    [userId: string]: BuyFilters;
  }>({});
  const [sellFilters, setSellFilters] = useState<{
    [userId: string]: SellFilters;
  }>({});
  const userId = localStorage.getItem("userId") || "default";
  // Add state to track per-token buyUntilReachedActive
  //const [buyUntilReachedActive, setBuyUntilReachedActive] = useState<{ [mint: string]: boolean }>({});
  // Add a ref to track polling intervals per token
  const buyUntilReachedIntervals = useRef<{ [mint: string]: NodeJS.Timeout }>(
    {}
  );
  // Add state for trailing stop loss and age per token
  const [trailingStopLossState, setTrailingStopLossState] = useState<{
    [mint: string]: string;
  }>({});
  const [trailingStopLossEnabledState, setTrailingStopLossEnabledState] =
    useState<{ [mint: string]: boolean }>({});
  const [timeBasedSellState, setTimeBasedSellState] = useState<{
    [mint: string]: string;
  }>({});
  const [timeBasedSellEnabledState, setTimeBasedSellEnabledState] = useState<{
    [mint: string]: boolean;
  }>({});
  //const [ageEnabledState, setAgeEnabledState] = useState<{ [mint: string]: boolean }>({});
  //const [ageValueState, setAgeValueState] = useState<{ [mint: string]: string }>({});
  const [waitForBuyersState, setWaitForBuyersState] = useState<{
    [mint: string]: string;
  }>({});
  const [waitForBuyersEnabledState, setWaitForBuyersEnabledState] = useState<{
    [mint: string]: boolean;
  }>({});
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawNotification, setWithdrawNotification] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({ show: false, message: "", type: "success" });
  const [solBalance, setSolBalance] = useState<number>(0);
  // State variables
  const [sortOrder24h, setSortOrder24h] = useState("desc");
  const [sortOrder24_48h, setSortOrder24_48h] = useState("desc");
  const [sortOrder48h, setSortOrder48h] = useState("desc");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [manualBuyAmount, setManualBuyAmount] = useState<string>("");
  const [activeSection, setActiveSection] = useState<
    "fresh-drops" | "heating-up" | "battle-tested"
  >("fresh-drops");
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const [showTokenPage, setShowTokenPage] = useState(false);

  // Helper function
  const filterTokensByAge = (
    tokens: Token[],
    minHours: number,
    maxHours: number,
    sortOrder: string
  ) => {
    const now = Date.now();
    const minMs = minHours * 60 * 60 * 1000;
    const maxMs = maxHours * 60 * 60 * 1000;

    return tokens
      .filter((token) => {
        const age = now - token.creationTimestamp;
        return age >= minMs && age < maxMs;
      })
      .sort((a, b) => {
        if (sortOrder === "desc") {
          return b.creationTimestamp - a.creationTimestamp;
        }
        return a.creationTimestamp - b.creationTimestamp;
      });
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  // Disable scroll when deposit modal is open
  useEffect(() => {
    if (depositModalOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "auto";
      document.body.style.position = "static";
      document.body.style.width = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
      document.body.style.position = "static";
      document.body.style.width = "auto";
    };
  }, [depositModalOpen]);

  // Preset state (copied from App.tsx ic)
  const {
    buyPresets = [],
    sellPresets = [],
    activeBuyPreset = 0,
    activeSellPreset = 0,
    setActiveBuyPreset,
    setActiveSellPreset,
    ws,
    walletAddress,
    setTransactionLoading,
  } = useWebSocket();

  const autoBuyEnabledRef = useRef(autoBuyEnabled);
  const bufferAmountRef = useRef(bufferAmount);
  const buyPresetsRef = useRef(buyPresets);
  const activeBuyPresetRef = useRef(activeBuyPreset);

  useEffect(() => {
    autoBuyEnabledRef.current = autoBuyEnabled;
  }, [autoBuyEnabled]);
  useEffect(() => {
    bufferAmountRef.current = bufferAmount;
  }, [bufferAmount]);
  useEffect(() => {
    buyPresetsRef.current = buyPresets;
  }, [buyPresets]);
  useEffect(() => {
    activeBuyPresetRef.current = activeBuyPreset;
  }, [activeBuyPreset]);

  const handleSettingsClick = () => setSettingsModalOpen(true);

  const handleTokenClick = (token: Token) => {
    setSelectedToken(token);
    setShowTokenPage(true);
  };

  // Handle buy button click
  const handleBuyClick = (token: Token, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    if (!manualBuyAmount || parseFloat(manualBuyAmount) <= 0) {
      setTransactionLoading({ type: 'buy', message: '❌ Please enter a valid amount' });
      setTimeout(() => setTransactionLoading({ type: null, message: '' }), 2000);
      return;
    }
    if (!ws) {
      setTransactionLoading({ type: 'buy', message: '❌ WebSocket not connected' });
      setTimeout(() => setTransactionLoading({ type: null, message: '' }), 2000);
      return;
    }
    const preset = buyPresets[activeBuyPreset] || {};
    if (!preset || Object.keys(preset).length === 0) {
      setTransactionLoading({ type: 'buy', message: '❌ No buy preset loaded' });
      setTimeout(() => setTransactionLoading({ type: null, message: '' }), 2000);
      return;
    }
    const amountLamports = Math.floor(parseFloat(manualBuyAmount) * 1e9);
    
    // Minimum amount check (at least 0.001 SOL)
    // if (amountLamports < 1_000_000) {
    //   setTransactionLoading({ type: 'buy', message: '❌ Minimum buy amount is 0.001 SOL' });
    //   setTimeout(() => setTransactionLoading({ type: null, message: '' }), 2000);
    //   return;
    // }

    // Set loading state
    setTransactionLoading({ type: 'buy', message: 'Buy transaction sending...' });

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

  const handleMyTokensClick = () => {
    if (ws) {
      // Close token details when switching views
      setShowTokenPage(false);
      setSelectedToken(null);
      setShowTokenDetails(false);

      if (!showMyTokens) {
        ws.send(JSON.stringify({ type: "GET_USER_TOKENS" }));
        setShowMyTokens(true);
        localStorage.setItem("currentView", "portfolio");
      } else {
        setShowMyTokens(false);
        localStorage.setItem("currentView", "discover");
      }
    }
  };

  // Fetch tokens function
  const fetchTokens = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication token not found");
        setLoading(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/tokens/all`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        if (res.status === 401 || res.status === 404) {
          // Auto-logout and redirect to login
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
          window.location.href = "/login"; // or your login route
          return;
        }
        throw new Error("Failed to fetch tokens");
      }

      const data = await res.json();
      console.log('[DEBUG] API Response:', data);
      console.log('[DEBUG] First token:', data.tokens?.[0]);
      console.log('[DEBUG] First token marketCap:', data.tokens?.[0]?.marketCap);
      console.log('[DEBUG] First token volume:', data.tokens?.[0]?.volume);
      console.log('[DEBUG] First token buys:', data.tokens?.[0]?.buys);
      console.log('[DEBUG] First token sells:', data.tokens?.[0]?.sells);
      setTokens(data.tokens || []);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to fetch tokens");
      setLoading(false);
    }
  };

  // Fetch tokens on mount with proper authentication
  useEffect(() => {
    fetchTokens();
  }, []);

  // Update "now" every second for real-time age
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = async (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === "AUTH_ERROR") {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        window.location.href = "/login";
        return;
      }
      if ((data.type === "NEW_TOKEN" || data.type === "NEW_PUMPFUN_TOKEN") && (data.token || data.data)) {
        const tokenData = data.token || data.data;
        
        // Transform PumpFun token data if needed
        const transformedToken = data.type === "NEW_PUMPFUN_TOKEN" ? {
          mint: tokenData.metadata.mint,
          name: tokenData.metadata.name,
          symbol: tokenData.metadata.symbol,
          imageUrl: tokenData.metadata.image,
          creationTimestamp: new Date(tokenData.metadata.createdAt).getTime(),
          currentPrice: tokenData.tokenAnalytics.priceNative,
          creator: tokenData.metadata.creator,
          marketCap: tokenData.tokenAnalytics.marketCap,
          volume: tokenData.tokenAnalytics.volume,
          holders: tokenData.holderStats.totalHolders,
          buys: tokenData.tokenAnalytics.buys,
          sells: tokenData.tokenAnalytics.sells,
          bondingCurveProgress: tokenData.bondingCurveProgress.bondingCurveProgress,
          website: tokenData.metadata.website,
          twitter: tokenData.metadata.twitter,
          telegram: tokenData.metadata.telegram,
          pumpLink: tokenData.metadata.pumpLink
        } : tokenData;
        // 1. Always update token list
        setTokens((prev) => {
          const exists = prev.find((t) => t.mint === transformedToken.mint);
          if (exists) {
            return prev.map((t) =>
              t.mint === transformedToken.mint ? transformedToken : t
            );
          }
          return [transformedToken, ...prev];
        });

        // 2. Token detected notification
        setAutoBuySnackbar({
          open: true,
          message: `Token detected: ${transformedToken.name || transformedToken.mint}`,
        });

        // 3. Only trigger auto-buy if eventType is 'launch'
        if (data.eventType === "launch") {
          console.log("auto buy");
          if (
            autoBuyEnabledRef.current &&
            bufferAmountRef.current &&
            !isNaN(Number(bufferAmountRef.current)) &&
            Number(bufferAmountRef.current) > 0 &&
            ws
          ) {
            console.log("auto buy inside");
            // --- BUY TIMEOUT LOGIC START ---
            const startTime = Date.now();
            // --- END BUY TIMEOUT LOGIC START ---
            const preset =
              buyPresetsRef.current[activeBuyPresetRef.current] || {};
            // --- NEW: Fetch whitelist/blacklist from backend at runtime ---
            (async () => {
              try {
                // 1. Fetch buyFilters from backend (new route, by userId)
                const userId = localStorage.getItem("userId");
                const buyFiltersRes = await fetch(
                  `${
                    import.meta.env.VITE_API_BASE_URL
                  }/api/user-filters/buy-filters-by-user-id?userId=${userId}`
                );
                const buyFiltersData = await buyFiltersRes.json();
                const userBuyFilters = buyFiltersData.buyFilters || {};
                //const maxMcap = Number(userBuyFilters.maxMcap) || 0;
                //const maxBuyers = Number(userBuyFilters.maxBuyers) || 0;
                // Debug log for buyFilters
                console.log("[AutoBuy DEBUG] buyFiltersData:", buyFiltersData);

                // 2. Fetch whitelist/blacklist from backend
                const token = localStorage.getItem("token");
                const [whitelistRes, blacklistRes] = await Promise.all([
                  fetch(
                    `${
                      import.meta.env.VITE_API_BASE_URL
                    }/api/user-filters/whitelist-devs`,
                    {
                      headers: { Authorization: `Bearer ${token}` },
                    }
                  ),
                  fetch(
                    `${
                      import.meta.env.VITE_API_BASE_URL
                    }/api/user-filters/blacklist-devs`,
                    {
                      headers: { Authorization: `Bearer ${token}` },
                    }
                  ),
                ]);
                const whitelistData = await whitelistRes.json();
                const blacklistData = await blacklistRes.json();
                const whitelistDevs = whitelistData.whitelistDevs || [];
                const blacklistDevs = blacklistData.blacklistDevs || [];
                if (
                  !autoBuyFilter(
                    transformedToken,
                    blacklistDevs,
                    whitelistDevs,
                    setAutoBuySnackbar
                  )
                )
                  return;

                // Allow buy
                const amountLamports = Math.floor(
                  Number(bufferAmountRef.current) * 1e9
                );
                const toLamports = (val: string) =>
                  Math.floor(Number(val) * 1e9);
                // After fetching userBuyFilters, add maxTokenAge logic before market cap/buyers check
                const noBribeMode = !!userBuyFilters.noBribeMode;

                // --- BUY TIMEOUT LOGIC CHECK ---
                const timeout = Number(userBuyFilters.timeout) || 0;
                if (timeout > 0) {
                  const elapsedSec = (Date.now() - startTime) / 1000;
                  console.log("TOTAL TIME: ", elapsedSec);
                  if (elapsedSec > timeout) {
                    setAutoBuySnackbar({
                      open: true,
                      message: `Auto-buy skipped: Buy timeout exceeded (${elapsedSec.toFixed(
                        2
                      )}s > ${timeout}s)`,
                    });
                    return;
                  }
                }

                console.log("TIME OUT: ", timeout);
                // --- END BUY TIMEOUT LOGIC CHECK ---
                // In the buy transaction, use bribeAmount = 0 if noBribeMode is enabled
                const bribeAmountToSend = noBribeMode
                  ? 0
                  : toLamports(preset.bribeAmount);
                console.log("Bribe Amount: ", bribeAmountToSend);
                ws.send(
                  JSON.stringify({
                    type: "MANUAL_BUY",
                    mintAddress: transformedToken.mint,
                    amount: amountLamports,
                    slippage: preset.slippage,
                    priorityFee: toLamports(preset.priorityFee),
                    bribeAmount: bribeAmountToSend,
                  })
                );
                setLastAutoBuyMint(transformedToken.mint);

                const buyUntilReached = !!userBuyFilters.buyUntilReached;
                const buyUntilMarketCap =
                  Number(userBuyFilters.buyUntilMarketCap) || 0;
                const buyUntilPrice = Number(userBuyFilters.buyUntilPrice) || 0;
                const buyUntilAmount =
                  Number(userBuyFilters.buyUntilAmount) || 0;

                if (buyUntilReached) {
                  // If an interval is already running for this token, do nothing
                  if (buyUntilReachedIntervals.current[transformedToken.mint]) return;
                  // Start polling for this token
                  buyUntilReachedIntervals.current[transformedToken.mint] =
                    setInterval(async () => {
                      try {
                        // Fetch latest metrics
                        const metricsRes = await fetch(
                          `${import.meta.env.VITE_API_BASE_URL}/api/tokens/${
                            transformedToken.mint
                          }/metrics`
                        );
                        const metrics = await metricsRes.json();
                        const mcap = Number(metrics.marketCapUsd) || 0;
                        const price = Number(metrics.currentPrice) || 0;
                        const amount = Number(metrics.amount) || 0;
                        console.log(
                          "[BuyUntilReached][Polling] Checking conditions:",
                          {
                            buyUntilMarketCap,
                            mcap,
                            buyUntilPrice,
                            price,
                            buyUntilAmount,
                            amount,
                          }
                        );
                        if (
                          (buyUntilMarketCap > 0 &&
                            mcap >= buyUntilMarketCap) ||
                          (buyUntilPrice > 0 && price >= buyUntilPrice) ||
                          (buyUntilAmount > 0 && amount >= buyUntilAmount)
                        ) {
                          console.log(
                            "[BuyUntilReached][Polling] Blocked: One or more on-chain values met/exceeded user limits.",
                            {
                              mcap,
                              buyUntilMarketCap,
                              price,
                              buyUntilPrice,
                              amount,
                              buyUntilAmount,
                            }
                          );
                          setAutoBuySnackbar({
                            open: true,
                            message:
                              "Auto-buy blocked: Buy Until Reached condition met.",
                          });
                          clearInterval(
                            buyUntilReachedIntervals.current[transformedToken.mint]
                          );
                          delete buyUntilReachedIntervals.current[
                            transformedToken.mint
                          ];
                          return;
                        }
                        // Else, trigger buy again
                        console.log(
                          "[BuyUntilReached][Polling] Allowed: All on-chain values below user limits. Triggering buy again."
                        );
                        // Add 1.5s delay before sending buy
                        await new Promise((res) => setTimeout(res, 1500));
                        // Reuse the same buy logic as before
                        const amountLamports = Math.floor(
                          Number(bufferAmountRef.current) * 1e9
                        );
                        const toLamports = (val: string) =>
                          Math.floor(Number(val) * 1e9);
                        const bribeAmountToSend = noBribeMode
                          ? 0
                          : toLamports(preset.bribeAmount);
                        ws.send(
                          JSON.stringify({
                            type: "MANUAL_BUY",
                            mintAddress: transformedToken.mint,
                            amount: amountLamports,
                            slippage: preset.slippage,
                            priorityFee: toLamports(preset.priorityFee),
                            bribeAmount: bribeAmountToSend,
                          })
                        );
                      } catch (err) {
                        console.error(
                          "[BuyUntilReached][Polling] Error during polling:",
                          err
                        );
                      }
                    }, 5000);
                }
              } catch (err) {
                setAutoBuySnackbar({
                  open: true,
                  message: "Auto-buy filter fetch failed.",
                });
              }
            })();
          }
        }
      }
      if (data.type === "MANUAL_BUY_SUCCESS") {
        const signature = data.signature || data.details?.signature || 'N/A';
        setTransactionLoading({ 
          type: 'buy', 
          message: `Buy successful! Signature: ${signature.substring(0, 4)}...${signature.slice(-4)}` 
        });
        setTimeout(() => setTransactionLoading({ type: null, message: '' }), 3000);
        // Show snackbar if this was an auto buy
        if (lastAutoBuyMint && data.details?.mint === lastAutoBuyMint) {
          setAutoBuySnackbar({
            open: true,
            message: "Auto buy order successful!",
          });
          setLastAutoBuyMint(null);
        }
      }
      if (data.type === "MANUAL_BUY_ERROR") {
        setTransactionLoading({ 
          type: 'buy', 
          message: `Buy failed: ${data.error || 'Unknown error'}` 
        });
        setTimeout(() => setTransactionLoading({ type: null, message: '' }), 3000);
      }
      if (data.type === "USER_TOKENS") {
        setWalletTokens(data.tokens || []);
      }
      if (data.type === "AUTO_SELL_TRIGGERED") {
        // Auto-sell triggered notification
        setAutoBuySnackbar({
          open: true,
          message: `Auto sell triggered for ${
            data.tokenName || data.mint
          }! P/L: ${data.profitLoss?.toFixed(2)}%`,
        });
      }
      if (data.type === "AUTO_SELL_SUCCESS") {
        // Auto-sell completed successfully
        setAutoBuySnackbar({
          open: true,
          message: `Auto sell completed! Received ${data.actualSolReceived?.toFixed(
            6
          )} SOL`,
        });
      }
      if (data.type === "AUTO_SELL_DISABLED") {
        // Auto-sell disabled notification
        setAutoBuySnackbar({
          open: true,
          message: `Auto sell disabled for ${data.tokenName || data.mint}`,
        });
      }
      if (data.type === "MANUAL_SELL_SUCCESS") {
        const signature = data.signature || data.details?.signature || 'N/A';
        setTransactionLoading({ 
          type: 'sell', 
          message: `Sell successful! Signature: ${signature.substring(0, 4)}...${signature.slice(-4)}` 
        });
        setTimeout(() => setTransactionLoading({ type: null, message: '' }), 3000);
        // Optionally refresh user tokens or update UI
      }
      if (data.type === "MANUAL_SELL_ERROR") {
        setTransactionLoading({ 
          type: 'sell', 
          message: `Sell failed: ${data.error || 'Unknown error'}` 
        });
        setTimeout(() => setTransactionLoading({ type: null, message: '' }), 3000);
      }
      if (data.type === "TOKEN_PRICE_UPDATE" && data.mint && data.price) {
        console.log("[FRONTEND] Received TOKEN_PRICE_UPDATE", data);
        console.log(
          "[FRONTEND] Current tokens:",
          tokens.map((t) => t.mint)
        );
        setTokens((prevTokens) =>
          prevTokens.map((token) =>
            token.mint === data.mint
              ? { ...token, currentPrice: data.price }
              : token
          )
        );
        setUserTokens((prevTokens) =>
          prevTokens.map((token) =>
            token.mint === data.mint
              ? { ...token, currentPrice: data.price }
              : token
          )
        );
      }
      if (data.type === "TOKEN_HOLDER_UPDATE" && data.mint && data.holderStats) {
        console.log("[FRONTEND] Received TOKEN_HOLDER_UPDATE", data);
        setTokens((prevTokens) =>
          prevTokens.map((token) =>
            token.mint === data.mint
              ? { ...token, holders: data.holderStats.totalHolders }
              : token
          )
        );
      }
      if (data.type === "SOL_BALANCE_UPDATE") {
        console.log("[SOL_BALANCE_UPDATE] New balance:", data.balance);
        setSolBalance(data.balance);
      }
      if (data.type === "WITHDRAW_SUCCESS") {
        console.log("[WITHDRAW SUCCESS] New balance:", data.newBalance);
        setSolBalance(data.newBalance);
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws]);

  useEffect(() => {
    if (ws) {
      ws.send(JSON.stringify({ type: "GET_PRESETS" }));
    }
  }, [ws]);

  useEffect(() => {
    // Jab bhi userTokens update ho, state ko backend ki value se sync karo
    const newAutoSellEnabledState: { [key: string]: boolean } = {};
    const newTakeProfitState: { [key: string]: string } = {};
    const newStopLossState: { [key: string]: string } = {};
    const newAutoSellPercentState: { [key: string]: string } = {};
    const newTrailingStopLossState: { [key: string]: string } = {};
    const newTrailingStopLossEnabledState: { [key: string]: boolean } = {};
    const newTimeBasedSellState: { [key: string]: string } = {};
    const newTimeBasedSellEnabledState: { [key: string]: boolean } = {};
    const newWaitForBuyersState: { [key: string]: string } = {};
    const newWaitForBuyersEnabledState: { [key: string]: boolean } = {};

    userTokens.forEach((token) => {
      newAutoSellEnabledState[token.mint] = !!token.autoSellEnabled;
      newTakeProfitState[token.mint] =
        token.takeProfit !== undefined ? String(token.takeProfit) : "";
      newStopLossState[token.mint] =
        token.stopLoss !== undefined ? String(token.stopLoss) : "";
      newAutoSellPercentState[token.mint] =
        token.autoSellPercent !== undefined
          ? String(token.autoSellPercent)
          : "";
      newTrailingStopLossState[token.mint] =
        token.trailingStopLossPercent !== undefined
          ? String(token.trailingStopLossPercent)
          : "";
      newTrailingStopLossEnabledState[token.mint] =
        !!token.trailingStopLossEnabled;
      newTimeBasedSellState[token.mint] =
        token.timeBasedSellSec !== undefined
          ? String(token.timeBasedSellSec)
          : "";
      newTimeBasedSellEnabledState[token.mint] = !!token.timeBasedSellEnabled;
      newWaitForBuyersState[token.mint] =
        token.waitForBuyersBeforeSell !== undefined
          ? String(token.waitForBuyersBeforeSell)
          : "";
      newWaitForBuyersEnabledState[token.mint] =
        !!token.waitForBuyersBeforeSellEnabled;
    });

    setAutoSellEnabledState(newAutoSellEnabledState);
    setTakeProfitState(newTakeProfitState);
    setStopLossState(newStopLossState);
    setAutoSellPercentState(newAutoSellPercentState);
    setTrailingStopLossState(newTrailingStopLossState);
    setTrailingStopLossEnabledState(newTrailingStopLossEnabledState);
    setTimeBasedSellState(newTimeBasedSellState);
    setTimeBasedSellEnabledState(newTimeBasedSellEnabledState);
    setWaitForBuyersState(newWaitForBuyersState);
    setWaitForBuyersEnabledState(newWaitForBuyersEnabledState);
  }, [userTokens]);

  useEffect(() => {
    if (!showMyTokens) return;
    const userId = localStorage.getItem("userId");
    if (!userId) return;
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auto-sell/user/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        setAutoSellConfigs(data.autoSells || []);
      });
  }, [showMyTokens]);

  useEffect(() => {
    // Merge walletTokens and autoSellConfigs
    if (!showMyTokens) return;
    const merged = walletTokens.map((token) => {
      const config = autoSellConfigs.find((c) => c.mint === token.mint);
      return {
        ...token,
        autoSellEnabled: config?.autoSellEnabled ?? false,
        takeProfit:
          config?.takeProfit !== undefined
            ? config.takeProfit
            : token.takeProfit !== undefined
            ? token.takeProfit
            : 10,
        stopLoss:
          config?.stopLoss !== undefined
            ? config.stopLoss
            : token.stopLoss !== undefined
            ? token.stopLoss
            : 10,
        autoSellPercent:
          config?.autoSellPercent !== undefined
            ? config.autoSellPercent
            : token.autoSellPercent !== undefined
            ? token.autoSellPercent
            : 100,
        trailingStopLossPercent:
          config?.trailingStopLossPercent !== undefined
            ? config.trailingStopLossPercent
            : token.trailingStopLossPercent !== undefined
            ? token.trailingStopLossPercent
            : 10,
        trailingStopLossEnabled:
          config?.trailingStopLossEnabled ??
          token.trailingStopLossEnabled ??
          false,
        timeBasedSellSec:
          config?.timeBasedSellSec !== undefined
            ? config.timeBasedSellSec
            : token.timeBasedSellSec !== undefined
            ? token.timeBasedSellSec
            : 0,
        timeBasedSellEnabled:
          config?.timeBasedSellEnabled ?? token.timeBasedSellEnabled ?? false,
        waitForBuyersBeforeSell:
          config?.waitForBuyersBeforeSell !== undefined
            ? config.waitForBuyersBeforeSell
            : token.waitForBuyersBeforeSell !== undefined
            ? token.waitForBuyersBeforeSell
            : 5,
        waitForBuyersBeforeSellEnabled:
          config?.waitForBuyersBeforeSellEnabled ??
          token.waitForBuyersBeforeSellEnabled ??
          false,
        // ...baaki fields agar chahiye
      };
    });
    setUserTokens(merged);
  }, [walletTokens, autoSellConfigs, showMyTokens]);

  useEffect(() => {
    if (!showMyTokens) return;
    userTokens.forEach((token) => {
      if (autoSellEnabledState[token.mint]) {
        const preset = sellPresets[activeSellPreset] || {};
        const payload = {
          userId,
          walletAddress,
          mint: token.mint,
          buyPrice: token.buyAmount || 0,
          takeProfit: Number(takeProfitState[token.mint]) || undefined,
          stopLoss: Number(stopLossState[token.mint]) || undefined,
          autoSellPercent: Number(autoSellPercentState[token.mint]) || 100,
          autoSellEnabled: true,
          slippage: preset.slippage || 5,
          priorityFee: preset.priorityFee || 0.001,
          bribeAmount: preset.bribeAmount || 0,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          trailingStopLossPercent:
            trailingStopLossState[token.mint] !== undefined &&
            trailingStopLossState[token.mint] !== ""
              ? Number(trailingStopLossState[token.mint])
              : 10,
          trailingStopLossEnabled:
            trailingStopLossEnabledState[token.mint] !== undefined
              ? trailingStopLossEnabledState[token.mint]
              : false,
          timeBasedSellSec:
            timeBasedSellState[token.mint] !== undefined &&
            timeBasedSellState[token.mint] !== ""
              ? Number(timeBasedSellState[token.mint])
              : 0,
          timeBasedSellEnabled:
            timeBasedSellEnabledState[token.mint] !== undefined
              ? timeBasedSellEnabledState[token.mint]
              : false,
          waitForBuyersBeforeSell: Number(waitForBuyersState[token.mint]) || 5,
          waitForBuyersBeforeSellEnabled:
            waitForBuyersEnabledState[token.mint] !== undefined
              ? waitForBuyersEnabledState[token.mint]
              : false,
        };
        // === YAHAN DEBUG ENTRY DALEIN ===
        console.log("Preset change POST:", payload, "preset:", preset);
        const API_URL = import.meta.env.VITE_API_BASE_URL;
        fetch(`${API_URL}/api/auto-sell/upsert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then((res) => res.json())
          .then((data) => console.log("Upsert response:", data));
      }
    });
  }, [activeSellPreset]);

  // Sort tokens based on creationTimestamp and sortOrder
  const sortedTokens = [...tokens].sort((a, b) => {
    if (sortOrder === "desc") {
      return b.creationTimestamp - a.creationTimestamp;
    } else {
      return a.creationTimestamp - b.creationTimestamp;
    }
  });

  const sortedUserTokens = [...userTokens].sort((a, b) => {
    if (sortOrder === "desc") {
      return b.creationTimestamp - a.creationTimestamp;
    } else {
      return a.creationTimestamp - b.creationTimestamp;
    }
  });

  // Helper for profit/loss calculation
  function getProfitLossPercent(buyPrice?: number, currentPrice?: number) {
    if (!buyPrice || !currentPrice || buyPrice === 0) return 0;
    return ((currentPrice - buyPrice) / buyPrice) * 100;
  }

  useEffect(() => {
    // Set default sell percent to 100 for all tokens if not already set
    setSellPercentsState((prev) => {
      const updated = { ...prev };
      tokens.forEach((token) => {
        if (updated[token.mint] === undefined) {
          updated[token.mint] = 100;
        }
      });
      return updated;
    });
  }, [tokens]);

  // Central auto-buy filter for whitelist/blacklist
  function autoBuyFilter(
    token: Token,
    blacklistDevs: string[],
    whitelistDevs: string[],
    setAutoBuySnackbar: (arg: { open: boolean; message: string }) => void
  ): boolean {
    const creator = (token.creator || "").trim();
    const whitelistNorm = whitelistDevs.map((d) => d.trim());
    const blacklistNorm = blacklistDevs.map((d) => d.trim());

    // Debug logs
    console.log("AutoBuyFilter DEBUG white black list:", {
      creator,
      whitelistNorm,
      blacklistNorm,
    });

    // If whitelist is empty or only ['true'], allow all except blacklist
    if (
      whitelistNorm.length === 0 ||
      (whitelistNorm.length === 1 && whitelistNorm[0] === "true")
    ) {
      const isBlacklisted = blacklistNorm.includes(creator);
      console.log("Comparing (whitelist true):", {
        creator,
        blacklistNorm,
        isBlacklisted,
      });
      if (isBlacklisted) {
        setAutoBuySnackbar({
          open: true,
          message: "Creator is blacklisted, cannot auto-buy.",
        });
        return false;
      }
      return true;
    }
    // If whitelist has real creators, only allow buy if creator is in whitelist and not in blacklist
    const isWhitelisted = whitelistNorm.includes(creator);
    const isBlacklisted = blacklistNorm.includes(creator);
    console.log("Comparing (real whitelist):", {
      creator,
      whitelistNorm,
      isWhitelisted,
      blacklistNorm,
      isBlacklisted,
    });
    if (!isWhitelisted) {
      setAutoBuySnackbar({
        open: true,
        message: "Creator is not whitelisted.",
      });
      return false;
    }
    if (isBlacklisted) {
      setAutoBuySnackbar({
        open: true,
        message: "Creator is blacklisted, cannot auto-buy.",
      });
      return false;
    }
    return true;
  }

  useEffect(() => {
    return () => {
      Object.values(buyUntilReachedIntervals.current).forEach(clearInterval);
    };
  }, []);

  function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  } else {
    return value.toFixed(2);
  }
}



  return (
    <>
      {showTokenPage ? (
        <TokenDetails
          open={true}
          fullPage={true}
          token={selectedToken}
          solBalance={solBalance}
          onClose={() => {
            setSelectedToken(null);
            setShowTokenPage(false);
          }}
        />
      ) : (
        <>
          <Navbar
            showMyTokens={showMyTokens}
            onMyTokensClick={handleMyTokensClick}
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
            solBalance={solBalance}
          />


          <div className={styles.container}>
            <div className={styles.header}>
              <h2 className={styles.title}>
                {showMyTokens ? "Portfolio" : "Trending Tokens"}
              </h2>
              <div className={styles.controls}>
                <Button
                  variant="outlined"
                  style={{ border: "none" }}
                  className={styles.filterButton}
                  onClick={() => setShowFilters(true)}
                >
                  <img
                    src="./homePageIcons/filter.png"
                    height={20}
                    width={20}
                    alt="Filter Icon"
                  />
                </Button>
                <Button
                  style={{ border: "none", padding: 0 }}
                  variant="outlined"
                  className={styles.settingsButton}
                  onClick={handleSettingsClick}
                >
                  <img
                    src="/homePageIcons/settings.png"
                    height={20}
                    width={20}
                    alt="Settings Icon"
                  />
                </Button>
              </div>
            </div>

            {/* Section Buttons for mobile view */}
            {!showMyTokens && (
              <div className={styles.sectionButtons}>
                <button
                  className={`${styles.sectionButton} ${
                    activeSection === "fresh-drops"
                      ? styles.sectionButtonActive
                      : ""
                  }`}
                  onClick={() => setActiveSection("fresh-drops")}
                >
                  Fresh-Drops
                </button>
                <button
                  className={`${styles.sectionButton} ${
                    activeSection === "heating-up"
                      ? styles.sectionButtonActive
                      : ""
                  }`}
                  onClick={() => setActiveSection("heating-up")}
                >
                  Heating-Up
                </button>
                <button
                  className={`${styles.sectionButton} ${
                    activeSection === "battle-tested"
                      ? styles.sectionButtonActive
                      : ""
                  }`}
                  onClick={() => setActiveSection("battle-tested")}
                >
                  Battle-Tested
                </button>
              </div>
            )}

            {showMyTokens ? (
              /* MY TOKENS VIEW */
              <div className={styles.tokenSectionsContainer}>
                <div className={styles.tokenSection}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Portfolio</h3>
                  </div>
                  <div className={styles.tokenGrid}>
                    {sortedUserTokens.length === 0 ? (
                      <div className={styles.noTokensMessage}>
                        You don't have any tokens yet
                      </div>
                    ) : (
                      sortedUserTokens.map((token) => {
                        const buyPrice = token.buyAmount;
                        const currentPrice = token.currentPrice;
                        const profitLoss = getProfitLossPercent(
                          buyPrice,
                          currentPrice
                        );
                        const profitLossColor =
                          profitLoss > 0
                            ? "#4CAF50"
                            : profitLoss < 0
                            ? "#ff6b6b"
                            : "#888";

                        return (
                          <div
                            key={token.mint}
                            className={styles.tokenCard}
                            onClick={() => handleTokenClick(token)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform =
                                "translateY(-2px)";
                              e.currentTarget.style.boxShadow =
                                "0 6px 12px rgba(0, 0, 0, 0.2)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 6px rgba(0, 0, 0, 0.1)";
                            }}
                          >
                            <div className={styles.tokenCardTop}>
                              <div className={styles.tokenImageContainer}>
                                <img
                                  src={token.imageUrl}
                                  alt={token.name}
                                  className={styles.tokenImage}
                                  onError={(e) =>
                                    (e.currentTarget.style.display = "none")
                                  }
                                />
                                <div
                                  className={styles.tokenCreator}
                                  title={
                                    token.creator || token.devAddress || "-"
                                  }
                                  onClick={() =>
                                    navigator.clipboard.writeText(
                                      token.creator || token.devAddress || "-"
                                    )
                                  }
                                >
                                  <span className={styles.tokenCreatorAddress}>
                                    {(
                                      token.creator ||
                                      token.devAddress ||
                                      "-"
                                    ).substring(0, 4)}
                                    ...
                                    {(
                                      token.creator ||
                                      token.devAddress ||
                                      "-"
                                    ).slice(-4)}
                                  </span>
                                </div>
                              </div>

                              <div className={styles.tokenInfo}>
                                <div className={styles.tokenNameRow}>
                                  <div className={styles.tokenNameWithMint}>
                                    <span className={styles.tokenName}>
                                      {token.name}
                                    </span>
                                    <span
                                      className={styles.tokenMintCopyIcon}
                                      title={token.mint}
                                      onClick={() => {
                                        navigator.clipboard.writeText(
                                          token.mint
                                        );
                                      }}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" ||
                                          e.key === " "
                                        ) {
                                          navigator.clipboard.writeText(
                                            token.mint
                                          );
                                        }
                                      }}
                                      aria-label={`Copy mint address: ${token.mint}`}
                                      style={{
                                        cursor: "pointer",
                                        marginLeft: "6px",
                                      }}
                                    >
                                      <FontAwesomeIcon icon={faCopy} />
                                    </span>
                                  </div>
                                </div>

                                <div className={styles.tokenAgeWithIcons}>
                                  <span className={styles.tokenAge}>
                                    {getAgeString(
                                      now - token.creationTimestamp
                                    )}
                                  </span>
                                </div>
                              </div>

                              <div className={styles.tokenStatsTop}>
                                <div className={styles.tokenLine}>
                                  <span className={styles.label}>MC</span>
                                  <span className={styles.mcValue}>$1.2M</span>
                                </div>
                                <div className={styles.tokenLine}>
                                  <span className={styles.label}>Vol</span>
                                  <span className={styles.defaultValue}>
                                    $256K
                                  </span>
                                </div>
                                <div className={styles.tokenLine}>
                                  <span className={styles.label}>Bal</span>
                                  <span className={styles.defaultValue}>
                                    {token.balance}
                                  </span>
                                </div>
                                <div className={styles.tokenLine}>
                                  <span className={styles.label}>P/L</span>
                                  <span
                                    className={styles.defaultValue}
                                    style={{ color: profitLossColor }}
                                  >
                                    {profitLoss > 0 ? "+" : ""}
                                    {profitLoss.toFixed(1)}%
                                  </span>
                                </div>
                                <div
                                  className={styles.tokenLine}
                                  title={toFullDecimalString(
                                    token.currentPrice || 0
                                  )}
                                >
                                  <span className={styles.label}>P</span>
                                  <img
                                    src="/footerIcon/solana.png"
                                    alt="SOL"
                                    className={styles.solanaIcon}
                                  />
                                  <span className={styles.defaultValue}>
                                    {formatPriceSmart(token.currentPrice || 0)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className={styles.tokenFooter}>
                              <div className={styles.bondingCurve}>
                                <FontAwesomeIcon icon={faUserTie} /> 3%
                              </div>

                              <button
                                className={styles.buyButtonGlass}
                                onClick={(e) => handleBuyClick(token, e)}
                                disabled={
                                  !manualBuyAmount ||
                                  parseFloat(manualBuyAmount) <= 0
                                }
                              >
                                <FontAwesomeIcon
                                  icon={faBolt}
                                  style={{ marginRight: 6 }}
                                />
                                {manualBuyAmount
                                  ? `${manualBuyAmount} SOL`
                                  : ""}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ALL TOKENS VIEW (with age-based sections) */
              <div className={styles.tokenSectionsContainer}>
                {/* Section 1: Tokens <= 24h */}
                <div
                  className={`${styles.tokenSection} ${
                    activeSection !== "fresh-drops" ? styles.hiddenOnMobile : ""
                  }`}
                >
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Fresh-Drops</h3>
                    <SectionFilters
                      sortOrder={sortOrder24h}
                      setSortOrder={setSortOrder24h}
                      sectionTitle="Fresh-Drops"
                      userId={userId}
                    />
                  </div>
                  <div className={styles.tokenGrid}>
                    {filterTokensByAge(sortedTokens, 0, 24, sortOrder24h).map(
                      (token) => (
                        <div
                          key={token.mint}
                          className={styles.tokenCard}
                          onClick={() => handleTokenClick(token)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform =
                              "translateY(-2px)";
                            e.currentTarget.style.boxShadow =
                              "0 6px 12px rgba(0, 0, 0, 0.2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow =
                              "0 4px 6px rgba(0, 0, 0, 0.1)";
                          }}
                        >
                          <div className={styles.tokenCardTop}>
                            <div className={styles.tokenImageContainer}>
                              <img
                                src={token.imageUrl}
                                alt={token.name}
                                className={styles.tokenImage}
                                onError={(e) =>
                                  (e.currentTarget.style.display = "none")
                                }
                              />
                              <div
                                className={styles.tokenCreator}
                                title={token.creator || token.devAddress || "-"}
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    token.creator || token.devAddress || "-"
                                  )
                                }
                              >
                                {" "}
                                <span className={styles.tokenCreatorAddress}>
                                  {(
                                    token.creator ||
                                    token.devAddress ||
                                    "-"
                                  ).substring(0, 4)}
                                  ...
                                  {(
                                    token.creator ||
                                    token.devAddress ||
                                    "-"
                                  ).slice(-4)}
                                </span>
                              </div>
                            </div>

                            <div className={styles.tokenInfo}>
                              <div className={styles.tokenNameRow}>
                                <div className={styles.tokenNameWithMint}>
                                  <span className={styles.tokenName}>
                                    {token.name}
                                  </span>

                                  <span
                                    className={styles.tokenMintCopyIcon}
                                    title={token.mint} // tooltip on hover
                                    onClick={() => {
                                      navigator.clipboard.writeText(token.mint);
                                      // Optional: show a toast/snackbar for feedback here
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        navigator.clipboard.writeText(
                                          token.mint
                                        );
                                      }
                                    }}
                                    aria-label={`Copy mint address: ${token.mint}`}
                                    style={{
                                      cursor: "pointer",
                                      marginLeft: "6px",
                                    }}
                                  >
                                    <FontAwesomeIcon icon={faCopy} />
                                  </span>
                                </div>
                              </div>

                              <div className={styles.tokenAgeWithIcons}>
                                <span className={styles.tokenAge}>
                                  {getAgeString(now - token.creationTimestamp)}
                                </span>
                                <div className={styles.iconRow}>
                                  <a
                                    href={token.pumpLink || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <FontAwesomeIcon
                                      icon={faUser}
                                      className={`${styles.icon} ${styles.userIcon}`}
                                    />
                                  </a>
                                  <a
                                    href={token.website || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <FontAwesomeIcon
                                      icon={faGlobe}
                                      className={`${styles.icon} ${styles.globeIcon}`}
                                    />
                                  </a>
                                  <a
                                    href={token.telegram || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <FontAwesomeIcon
                                      icon={faTelegram}
                                      className={`${styles.icon} ${styles.telegramIcon}`}
                                    />
                                  </a>
                                  <a
                                    href={token.pumpLink || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <FontAwesomeIcon
                                      icon={faPills}
                                      className={`${styles.icon} ${styles.pillsIcon}`}
                                    />
                                  </a>
                                  <a
                                    href={`https://solscan.io/token/${token.mint}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <FontAwesomeIcon
                                      icon={faMagnifyingGlass}
                                      className={`${styles.icon} ${styles.searchIcon}`}
                                    />
                                  </a>
                                </div>
                              </div>

                              <div className={styles.tokenStatsRow}>
                                <div className={styles.statItem}>
                                  <FontAwesomeIcon
                                    icon={faUsers}
                                    className={styles.statIcon}
                                  />
                                  <span className={styles.statValue}>{token.holders || 0}</span>
                                </div>
                                <div className={styles.statItem}>
                                  <FontAwesomeIcon
                                    icon={faArrowUp}
                                    className={`${styles.statIcon} ${styles.stateIconUP}`}
                                  />
                                  <span className={styles.statValue}>{token.buys || 0}</span>
                                </div>
                                <div className={styles.statItem}>
                                  <FontAwesomeIcon
                                    icon={faArrowDown}
                                    className={`${styles.statIcon} ${styles.stateIconDOWN}`}
                                  />
                                  <span className={styles.statValue}>{token.sells || 0}</span>
                                </div>
                              </div>
                            </div>

                            <div className={styles.tokenStatsTop}>
                              <div className={styles.tokenLine}>
                                <span
                                  className={styles.label}
                                  style={{
                                    fontSize: "13px",
                                    marginBottom: "4px",
                                  }}
                                >
                                  MC
                                </span>
                                <span
                                  className={styles.mcValue}
                                  style={{
                                    fontSize: "13px",
                                    marginBottom: "4px",
                                  }}
                                >
                                  {/* {token.marketCap ? `$${(token.marketCap).toFixed(4)}M` : '$0'} */}
                                  {token.marketCap ? `$${formatNumber(token.marketCap)}` : '$0'}

                                </span>
                              </div>
                              <div className={styles.tokenLine}>
                                <span className={styles.label}>Vol</span>
                                <span className={styles.defaultValue}>
                                  {/* {token.volume ? `$${(token.volume / 1000).toFixed(0)}K` : '$0'} */}
                                  {token.volume ? `$${formatNumber(token.volume)}` : '$0'}
                                </span>
                              </div>
                              <div className={styles.tokenLine}>
                                <span className={styles.label}>TX</span>
                                <span className={styles.defaultValue}>
                                  {/* {token.buys && token.sells ? `${((token.buys + token.sells))}` : '0'} */}
                                  {`${(token.buys || 0) + (token.sells || 0)}`}

                                </span>
                              </div>
                              <div
                                className={styles.tokenLine}
                                title={toFullDecimalString(
                                  token.currentPrice || 0
                                )}
                              >
                                <span className={styles.label}>P</span>
                                <img
                                  src="/footerIcon/solana.png"
                                  alt="SOL"
                                  className={styles.solanaIcon}
                                />
                                <span className={styles.defaultValue}>
                                  {formatPriceSmart(token.currentPrice || 0)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className={styles.tokenFooter}>
                            <div className={styles.bondingCurve}>
                              <FontAwesomeIcon icon={faUserTie} /> {token.bondingCurveProgress ? `${token.bondingCurveProgress.toFixed(1)}%` : '0%'}
                            </div>

                            <button
                              className={styles.buyButtonGlass}
                              onClick={(e) => handleBuyClick(token, e)}
                              disabled={
                                !manualBuyAmount ||
                                parseFloat(manualBuyAmount) <= 0
                              }
                            >
                              <FontAwesomeIcon
                                icon={faBolt}
                                style={{ marginRight: 6 }}
                              />
                              {manualBuyAmount ? `${manualBuyAmount} SOL` : ""}
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Section 2: Tokens 24h-48h */}
                <div
                  className={`${styles.tokenSection} ${
                    activeSection !== "heating-up" ? styles.hiddenOnMobile : ""
                  }`}
                >
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Heating-Up</h3>
                    <SectionFilters
                      sortOrder={sortOrder24_48h}
                      setSortOrder={setSortOrder24_48h}
                      sectionTitle="Heating-Up"
                      userId={userId}
                    />
                  </div>
                  <div className={styles.tokenGrid}>
                    {filterTokensByAge(
                      sortedTokens,
                      24,
                      48,
                      sortOrder24_48h
                    ).map((token) => (
                      <div
                        key={token.mint}
                        className={styles.tokenCard}
                        onClick={() => handleTokenClick(token)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow =
                            "0 6px 12px rgba(0, 0, 0, 0.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 4px 6px rgba(0, 0, 0, 0.1)";
                        }}
                      >
                        <div className={styles.tokenCardTop}>
                          <div className={styles.tokenImageContainer}>
                            <img
                              src={token.imageUrl}
                              alt={token.name}
                              className={styles.tokenImage}
                              onError={(e) =>
                                (e.currentTarget.style.display = "none")
                              }
                            />
                            <div
                              className={styles.tokenCreator}
                              title={token.creator || token.devAddress || "-"}
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  token.creator || token.devAddress || "-"
                                )
                              }
                            >
                              {" "}
                              <span className={styles.tokenCreatorAddress}>
                                {(
                                  token.creator ||
                                  token.devAddress ||
                                  "-"
                                ).substring(0, 4)}
                                ...
                                {(
                                  token.creator ||
                                  token.devAddress ||
                                  "-"
                                ).slice(-4)}
                              </span>
                            </div>
                          </div>

                          <div className={styles.tokenInfo}>
                            <div className={styles.tokenNameRow}>
                              <div className={styles.tokenNameWithMint}>
                                <span className={styles.tokenName}>
                                  {token.name}
                                </span>

                                <span
                                  className={styles.tokenMintCopyIcon}
                                  title={token.mint} // tooltip on hover
                                  onClick={() => {
                                    navigator.clipboard.writeText(token.mint);
                                    // Optional: show a toast/snackbar for feedback here
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      navigator.clipboard.writeText(token.mint);
                                    }
                                  }}
                                  aria-label={`Copy mint address: ${token.mint}`}
                                  style={{
                                    cursor: "pointer",
                                    marginLeft: "6px",
                                  }}
                                >
                                  <FontAwesomeIcon icon={faCopy} />
                                </span>
                              </div>
                            </div>

                            <div className={styles.tokenAgeWithIcons}>
                              <span className={styles.tokenAge}>
                                {getAgeString(now - token.creationTimestamp)}
                              </span>
                              <div className={styles.iconRow}>
                                <a
                                  href={token.pumpLink || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FontAwesomeIcon
                                    icon={faUser}
                                    className={`${styles.icon} ${styles.userIcon}`}
                                  />
                                </a>
                                <a
                                  href={token.website || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FontAwesomeIcon
                                    icon={faGlobe}
                                    className={`${styles.icon} ${styles.globeIcon}`}
                                  />
                                </a>
                                <a
                                  href={token.telegram || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FontAwesomeIcon
                                    icon={faTelegram}
                                    className={`${styles.icon} ${styles.telegramIcon}`}
                                  />
                                </a>
                                <a
                                  href={token.pumpLink || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FontAwesomeIcon
                                    icon={faPills}
                                    className={`${styles.icon} ${styles.pillsIcon}`}
                                  />
                                </a>
                                <a
                                  href={`https://solscan.io/token/${token.mint}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FontAwesomeIcon
                                    icon={faMagnifyingGlass}
                                    className={`${styles.icon} ${styles.searchIcon}`}
                                  />
                                </a>
                              </div>
                            </div>

                            <div className={styles.tokenStatsRow}>
                              <div className={styles.statItem}>
                                <FontAwesomeIcon
                                  icon={faUsers}
                                  className={styles.statIcon}
                                />
                                <span className={styles.statValue}>{token.holders || 0}</span>
                              </div>
                              <div className={styles.statItem}>
                                <FontAwesomeIcon
                                  icon={faArrowUp}
                                  className={`${styles.statIcon} ${styles.stateIconUP}`}
                                />
                                <span className={styles.statValue}>{token.buys || 0}</span>
                              </div>
                              <div className={styles.statItem}>
                                <FontAwesomeIcon
                                  icon={faArrowDown}
                                  className={`${styles.statIcon} ${styles.stateIconDOWN}`}
                                />
                                <span className={styles.statValue}>{token.sells || 0}</span>
                              </div>
                            </div>
                          </div>

                          <div className={styles.tokenStatsTop}>
                            <div className={styles.tokenLine}>
                              <span
                                className={styles.label}
                                style={{
                                  fontSize: "13px",
                                  marginBottom: "4px",
                                }}
                              >
                                MC
                              </span>
                              <span
                                className={styles.mcValue}
                                style={{
                                  fontSize: "13px",
                                  marginBottom: "4px",
                                }}
                              >
                                {token.marketCap ? `$${(token.marketCap / 1000000).toFixed(1)}M` : '$0'}
                              </span>
                            </div>
                            <div className={styles.tokenLine}>
                              <span className={styles.label}>Vol</span>
                              <span className={styles.defaultValue}>
                                {token.volume ? `$${(token.volume / 1000).toFixed(0)}K` : '$0'}
                              </span>
                            </div>
                            <div className={styles.tokenLine}>
                              <span className={styles.label}>TX</span>
                              <span className={styles.defaultValue}>
                                {token.buys && token.sells ? `${((token.buys + token.sells) / 1000).toFixed(1)}K` : '0'}
                              </span>
                            </div>
                            <div
                              className={styles.tokenLine}
                              title={toFullDecimalString(
                                token.currentPrice || 0
                              )}
                            >
                              <span className={styles.label}>P</span>
                              <img
                                src="/footerIcon/solana.png"
                                alt="SOL"
                                className={styles.solanaIcon}
                              />
                              <span className={styles.defaultValue}>
                                {formatPriceSmart(token.currentPrice || 0)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={styles.tokenFooter}>
                          <div className={styles.bondingCurve}>
                            <FontAwesomeIcon icon={faUserTie} /> {token.bondingCurveProgress ? `${token.bondingCurveProgress.toFixed(1)}%` : '0%'}
                          </div>

                          <button
                            className={styles.buyButtonGlass}
                            onClick={(e) => handleBuyClick(token, e)}
                            disabled={
                              !manualBuyAmount ||
                              parseFloat(manualBuyAmount) <= 0
                            }
                          >
                            <FontAwesomeIcon
                              icon={faBolt}
                              style={{ marginRight: 6 }}
                            />
                            {manualBuyAmount ? `${manualBuyAmount} SOL` : ""}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3: Tokens > 48h */}
                <div
                  className={`${styles.tokenSection} ${
                    activeSection !== "battle-tested"
                      ? styles.hiddenOnMobile
                      : ""
                  }`}
                >
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Battle-Tested</h3>
                    <SectionFilters
                      sortOrder={sortOrder48h}
                      setSortOrder={setSortOrder48h}
                      sectionTitle="Battle-Tested"
                      userId={userId}
                    />
                  </div>
                  <div className={styles.tokenGrid}>
                    {filterTokensByAge(
                      sortedTokens,
                      48,
                      Infinity,
                      sortOrder48h
                    ).map((token) => (
                      <div
                        key={token.mint}
                        className={styles.tokenCard}
                        onClick={() => handleTokenClick(token)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow =
                            "0 6px 12px rgba(0, 0, 0, 0.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 4px 6px rgba(0, 0, 0, 0.1)";
                        }}
                      >
                        <div className={styles.tokenCardTop}>
                          <div className={styles.tokenImageContainer}>
                            <img
                              src={token.imageUrl}
                              alt={token.name}
                              className={styles.tokenImage}
                              onError={(e) =>
                                (e.currentTarget.style.display = "none")
                              }
                            />
                            <div
                              className={styles.tokenCreator}
                              title={token.creator || token.devAddress || "-"}
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  token.creator || token.devAddress || "-"
                                )
                              }
                            >
                              {" "}
                              <span className={styles.tokenCreatorAddress}>
                                {(
                                  token.creator ||
                                  token.devAddress ||
                                  "-"
                                ).substring(0, 4)}
                                ...
                                {(
                                  token.creator ||
                                  token.devAddress ||
                                  "-"
                                ).slice(-4)}
                              </span>
                            </div>
                          </div>

                          <div className={styles.tokenInfo}>
                            <div className={styles.tokenNameRow}>
                              <div className={styles.tokenNameWithMint}>
                                <span className={styles.tokenName}>
                                  {token.name}
                                </span>

                                <span
                                  className={styles.tokenMintCopyIcon}
                                  title={token.mint} // tooltip on hover
                                  onClick={() => {
                                    navigator.clipboard.writeText(token.mint);
                                    // Optional: show a toast/snackbar for feedback here
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      navigator.clipboard.writeText(token.mint);
                                    }
                                  }}
                                  aria-label={`Copy mint address: ${token.mint}`}
                                  style={{
                                    cursor: "pointer",
                                    marginLeft: "6px",
                                  }}
                                >
                                  <FontAwesomeIcon icon={faCopy} />
                                </span>
                              </div>
                            </div>

                            <div className={styles.tokenAgeWithIcons}>
                              <span className={styles.tokenAge}>
                                {getAgeString(now - token.creationTimestamp)}
                              </span>
                              <div className={styles.iconRow}>
                                <a
                                  href={token.pumpLink || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FontAwesomeIcon
                                    icon={faUser}
                                    className={`${styles.icon} ${styles.userIcon}`}
                                  />
                                </a>
                                <a
                                  href={token.website || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FontAwesomeIcon
                                    icon={faGlobe}
                                    className={`${styles.icon} ${styles.globeIcon}`}
                                  />
                                </a>
                                <a
                                  href={token.telegram || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FontAwesomeIcon
                                    icon={faTelegram}
                                    className={`${styles.icon} ${styles.telegramIcon}`}
                                  />
                                </a>
                                <a
                                  href={token.pumpLink || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FontAwesomeIcon
                                    icon={faPills}
                                    className={`${styles.icon} ${styles.pillsIcon}`}
                                  />
                                </a>
                                <a
                                  href={`https://solscan.io/token/${token.mint}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <FontAwesomeIcon
                                    icon={faMagnifyingGlass}
                                    className={`${styles.icon} ${styles.searchIcon}`}
                                  />
                                </a>
                              </div>
                            </div>

                            <div className={styles.tokenStatsRow}>
                              <div className={styles.statItem}>
                                <FontAwesomeIcon
                                  icon={faUsers}
                                  className={styles.statIcon}
                                />
                                <span className={styles.statValue}>{token.holders || 0}</span>
                              </div>
                              <div className={styles.statItem}>
                                <FontAwesomeIcon
                                  icon={faArrowUp}
                                  className={`${styles.statIcon} ${styles.stateIconUP}`}
                                />
                                <span className={styles.statValue}>{token.buys || 0}</span>
                              </div>
                              <div className={styles.statItem}>
                                <FontAwesomeIcon
                                  icon={faArrowDown}
                                  className={`${styles.statIcon} ${styles.stateIconDOWN}`}
                                />
                                <span className={styles.statValue}>{token.sells || 0}</span>
                              </div>
                            </div>
                          </div>

                          <div className={styles.tokenStatsTop}>
                            <div className={styles.tokenLine}>
                              <span
                                className={styles.label}
                                style={{
                                  fontSize: "13px",
                                  marginBottom: "4px",
                                }}
                              >
                                MC
                              </span>
                              <span
                                className={styles.mcValue}
                                style={{
                                  fontSize: "13px",
                                  marginBottom: "4px",
                                }}
                              >
                                {token.marketCap ? `$${(token.marketCap / 1000000).toFixed(1)}M` : '$0'}
                              </span>
                            </div>
                            <div className={styles.tokenLine}>
                              <span className={styles.label}>Vol</span>
                              <span className={styles.defaultValue}>
                                {token.volume ? `$${(token.volume / 1000).toFixed(0)}K` : '$0'}
                              </span>
                            </div>
                            <div className={styles.tokenLine}>
                              <span className={styles.label}>TX</span>
                              <span className={styles.defaultValue}>
                                {token.buys && token.sells ? `${((token.buys + token.sells) / 1000).toFixed(1)}K` : '0'}
                              </span>
                            </div>
                            <div
                              className={styles.tokenLine}
                              title={toFullDecimalString(
                                token.currentPrice || 0
                              )}
                            >
                              <span className={styles.label}>P</span>
                              <img
                                src="/footerIcon/solana.png"
                                alt="SOL"
                                className={styles.solanaIcon}
                              />
                              <span className={styles.defaultValue}>
                                {formatPriceSmart(token.currentPrice || 0)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={styles.tokenFooter}>
                          <div className={styles.bondingCurve}>
                            <FontAwesomeIcon icon={faUserTie} /> {token.bondingCurveProgress ? `${token.bondingCurveProgress.toFixed(1)}%` : '0%'}
                          </div>

                          <button
                            className={styles.buyButtonGlass}
                            onClick={(e) => handleBuyClick(token, e)}
                            disabled={
                              !manualBuyAmount ||
                              parseFloat(manualBuyAmount) <= 0
                            }
                          >
                            <FontAwesomeIcon
                              icon={faBolt}
                              style={{ marginRight: 6 }}
                            />
                            {manualBuyAmount ? `${manualBuyAmount} SOL` : ""}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <HomeSetting
            open={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            autoBuyEnabled={autoBuyEnabled}
            setAutoBuyEnabled={setAutoBuyEnabled}
            bufferAmount={bufferAmount}
            setBufferAmount={setBufferAmount}
            manualBuyAmount={manualBuyAmount}
            setManualBuyAmount={setManualBuyAmount}
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
          <BuySellFilterPanel
            open={showFilters}
            onClose={() => setShowFilters(false)}
            userId={userId}
            buyFilters={buyFilters[userId] || {}}
            sellFilters={sellFilters[userId] || {}}
            onChangeBuyFilters={(filters) =>
              setBuyFilters((prev) => ({ ...prev, [userId]: filters }))
            }
            onChangeSellFilters={(filters) =>
              setSellFilters((prev) => ({ ...prev, [userId]: filters }))
            }
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
            onNotification={setWithdrawNotification}
          />

          {withdrawNotification.show && (
            <div
              className={`withdraw-notification-global${
                withdrawNotification.type === "error" ? " error" : ""
              }`}
            >
              <span style={{ flex: 1 }}>{withdrawNotification.message}</span>
              <button
                className="withdraw-notification-close"
                onClick={() =>
                  setWithdrawNotification({
                    show: false,
                    message: "",
                    type: "success",
                  })
                }
                aria-label="Close notification"
                title="Close"
              >
                ×
              </button>
            </div>
          )}
          <FooterBar onOpenSettings={() => setPresetModalOpen(true)} />

          <TokenDetails
            open={showTokenDetails}
            onClose={() => setShowTokenDetails(false)}
            token={selectedToken}
            solBalance={solBalance}
          />
        </>
      )}
    </>
  );
};

export default TokenListWithAge;

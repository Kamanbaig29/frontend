import React, { useEffect, useState, useRef } from "react";
import {
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
} from "@mui/material";
//import { FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";
//import { WebSocketContext } from '../context/webSocketContext';
//import { PublicKey, Connection } from '@solana/web3.js';
import PresetModal from "./PresetModal";
//import ActivePresetBar from './ActivePresetBar';
import { useWebSocket } from "../context/webSocketContext";
//import SettingsIcon from '@mui/icons-material/Settings';
import BuySellFilterPanel, {
  type BuyFilters,
  type SellFilters,
} from "./BuySellFilterPanel";
//import FilterListIcon from "@mui/icons-material/FilterList"; // or your icon
import Navbar from "./Navbar";
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";
import FooterBar from "./FooterBar";
import styles from "../assets/TokenListWithAge.module.css";
import HomeSetting from "./homeSetting";
import SectionFilters from "./sectionFilters";
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
};

function getAgeString(ageMs: number) {
  const totalSeconds = Math.floor(ageMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function toFullDecimalString(num: number) {
  let str = num.toString();
  if (str.includes("e") || str.includes("E")) {
    return num.toFixed(20).replace(/\.?0+$/, "");
  }
  return str;
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

const sellPercents = [10, 30, 50, 100];

const TokenListWithAge: React.FC = () => {
  // All useState, useEffect, useRef, etc. go here
  const [tokens, setTokens] = useState<Token[]>([]);
  const [now, setNow] = useState(Date.now());
  const [, setLoading] = useState(true);
  const [, setError] = useState("");
  const [sortOrder] = useState<"desc" | "asc">("desc"); // 'desc' = newest first
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [buyAmounts, setBuyAmounts] = useState<{ [key: string]: string }>({});
  const [showMyTokens, setShowMyTokens] = useState(false);
  const [walletTokens, setWalletTokens] = useState<Token[]>([]);
  const [autoSellConfigs, setAutoSellConfigs] = useState<any[]>([]);
  const [userTokens, setUserTokens] = useState<Token[]>([]);
  const [sellPercentsState, setSellPercentsState] = useState<{
    [key: string]: number;
  }>({});
  const [autoBuyEnabled, setAutoBuyEnabled] = useState(false);
  const [bufferAmount, setBufferAmount] = useState<string>("");
  const [autoBuySnackbar, setAutoBuySnackbar] = useState<{
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

  // Handle buy amount input change
  const handleBuyAmountChange = (mint: string, value: string) => {
    setBuyAmounts((prev) => ({
      ...prev,
      [mint]: value,
    }));
  };

  const handleSettingsClick = () => setSettingsModalOpen(true);

  // Handle buy button click
  const handleBuyClick = (token: Token) => {
    const amount = buyAmounts[token.mint];
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (!ws) {
      alert("WebSocket not connected");
      return;
    }
    const preset = buyPresets[activeBuyPreset] || {};
    if (!preset || Object.keys(preset).length === 0) {
      alert("No buy preset loaded! Please set your buy preset first.");
      return;
    }
    const amountLamports = Math.floor(parseFloat(amount) * 1e9);

    // Debug: See what is being sent
    console.log("Manual buy with preset:", preset);

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
      if (!showMyTokens) {
        ws.send(JSON.stringify({ type: "GET_USER_TOKENS" }));
        setShowMyTokens(true);
      } else {
        setShowMyTokens(false);
      }
    }
  };

  const handleSellPercentChange = (mint: string, value: number) => {
    setSellPercentsState((prev) => ({
      ...prev,
      [mint]: value,
    }));
  };

  const handleSellClick = (token: Token) => {
    const percent = sellPercentsState[token.mint];
    if (!percent || percent <= 0) {
      alert("Please select a valid sell percent");
      return;
    }
    if (!ws) {
      alert("WebSocket not connected");
      return;
    }
    const preset = sellPresets[activeSellPreset] || {};
    if (!preset || Object.keys(preset).length === 0) {
      alert("No sell preset loaded! Please set your sell preset first.");
      return;
    }

    // Debug: See what is being sent
    console.log("Manual sell with preset:", preset);

    // FIX: Send fees in SOL (not lamports) - backend expects SOL values
    ws.send(
      JSON.stringify({
        type: "MANUAL_SELL",
        mintAddress: token.mint,
        percent,
        slippage: preset.slippage,
        priorityFee: Number(preset.priorityFee), // Send as SOL, not lamports
        bribeAmount: Number(preset.bribeAmount), // Send as SOL, not lamports
        walletAddress,
      })
    );
  };

  const handleTakeProfitChange = (mint: string, value: string) => {
    setTakeProfitState((prev) => ({
      ...prev,
      [mint]: value,
    }));

    if (autoSellEnabledState[mint]) {
      if (!walletAddress) {
        alert("Wallet address not loaded. Please refresh or re-login.");
        return;
      }
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find((t) => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(value) || undefined,
        stopLoss: Number(stopLossState[mint]) || undefined,
        autoSellPercent: Number(autoSellPercentState[mint]) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find((t) => t.mint === mint)?.name,
        tokenSymbol: userTokens.find((t) => t.mint === mint)?.symbol,
      };
      console.log(
        "TakeProfitChange payload:",
        payload,
        "walletAddress:",
        walletAddress
      );
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  };

  const handleStopLossChange = (mint: string, value: string) => {
    setStopLossState((prev) => ({
      ...prev,
      [mint]: value,
    }));

    if (autoSellEnabledState[mint]) {
      if (!walletAddress) {
        alert("Wallet address not loaded. Please refresh or re-login.");
        return;
      }
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find((t) => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(takeProfitState[mint]) || undefined,
        stopLoss: Number(value) || undefined,
        autoSellPercent: Number(autoSellPercentState[mint]) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find((t) => t.mint === mint)?.name,
        tokenSymbol: userTokens.find((t) => t.mint === mint)?.symbol,
      };
      console.log(
        "StopLossChange payload:",
        payload,
        "walletAddress:",
        walletAddress
      );
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  };

  const handleAutoSellPercentChange = (mint: string, value: string) => {
    setAutoSellPercentState((prev) => ({
      ...prev,
      [mint]: value,
    }));

    if (autoSellEnabledState[mint]) {
      if (!walletAddress) {
        alert("Wallet address not loaded. Please refresh or re-login.");
        return;
      }
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find((t) => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(takeProfitState[mint]) || undefined,
        stopLoss: Number(stopLossState[mint]) || undefined,
        autoSellPercent: Number(value) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find((t) => t.mint === mint)?.name,
        tokenSymbol: userTokens.find((t) => t.mint === mint)?.symbol,
      };
      console.log(
        "AutoSellPercentChange payload:",
        payload,
        "walletAddress:",
        walletAddress
      );
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  };

  const handleAutoSellToggle = (token: Token) => {
    if (!walletAddress) {
      alert("Wallet address not loaded. Please refresh or re-login.");
      return;
    }
    const enabled = !autoSellEnabledState[token.mint];
    setAutoSellEnabledState((prev) => ({
      ...prev,
      [token.mint]: enabled,
    }));

    if (enabled) {
      // Sync input fields with backend values
      setTakeProfitState((prev) => ({
        ...prev,
        [token.mint]:
          token.takeProfit !== undefined ? String(token.takeProfit) : "",
      }));
      setStopLossState((prev) => ({
        ...prev,
        [token.mint]:
          token.stopLoss !== undefined ? String(token.stopLoss) : "",
      }));
      setAutoSellPercentState((prev) => ({
        ...prev,
        [token.mint]:
          token.autoSellPercent !== undefined
            ? String(token.autoSellPercent)
            : "",
      }));
      // Ensure trailingStopLossState has a value
      setTrailingStopLossState((prev) => ({
        ...prev,
        [token.mint]:
          prev[token.mint] !== undefined && prev[token.mint] !== ""
            ? prev[token.mint]
            : "10",
      }));
      // Ensure timeBasedSellState has a value
      setTimeBasedSellState((prev) => ({
        ...prev,
        [token.mint]:
          prev[token.mint] !== undefined && prev[token.mint] !== ""
            ? prev[token.mint]
            : "0",
      }));
      // Ensure waitForBuyersState has a value
      setWaitForBuyersState((prev) => ({
        ...prev,
        [token.mint]:
          prev[token.mint] !== undefined && prev[token.mint] !== ""
            ? prev[token.mint]
            : "5",
      }));
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint: token.mint,
        buyPrice: token.buyAmount || 0,
        takeProfit: Number(takeProfitState[token.mint]) || 10,
        stopLoss: Number(stopLossState[token.mint]) || 10,
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
      console.log(
        "AutoSell ON payload:",
        payload,
        "walletAddress:",
        walletAddress
      );
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      const payload = {
        userId,
        walletAddress,
        mint: token.mint,
        buyPrice: token.buyAmount || 0,
        autoSellPercent: Number(autoSellPercentState[token.mint]) || 100,
        autoSellEnabled: false,
      };
      console.log(
        "AutoSell OFF payload:",
        payload,
        "walletAddress:",
        walletAddress
      );
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  };

  // Fetch tokens on mount with proper authentication
  useEffect(() => {
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
        setTokens(data.tokens || []);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to fetch tokens");
        setLoading(false);
      }
    };

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
      if (data.type === "NEW_TOKEN" && data.token) {
        // 1. Always update token list
        setTokens((prev) => {
          const exists = prev.find((t) => t.mint === data.token.mint);
          if (exists) {
            return prev.map((t) =>
              t.mint === data.token.mint ? data.token : t
            );
          }
          return [data.token, ...prev];
        });

        // 2. Token detected notification
        setAutoBuySnackbar({
          open: true,
          message: `Token detected: ${data.token.name || data.token.mint}`,
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
                    data.token,
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
                    mintAddress: data.token.mint,
                    amount: amountLamports,
                    slippage: preset.slippage,
                    priorityFee: toLamports(preset.priorityFee),
                    bribeAmount: bribeAmountToSend,
                  })
                );
                setLastAutoBuyMint(data.token.mint);

                const buyUntilReached = !!userBuyFilters.buyUntilReached;
                const buyUntilMarketCap =
                  Number(userBuyFilters.buyUntilMarketCap) || 0;
                const buyUntilPrice = Number(userBuyFilters.buyUntilPrice) || 0;
                const buyUntilAmount =
                  Number(userBuyFilters.buyUntilAmount) || 0;

                if (buyUntilReached) {
                  // If an interval is already running for this token, do nothing
                  if (buyUntilReachedIntervals.current[data.token.mint]) return;
                  // Start polling for this token
                  buyUntilReachedIntervals.current[data.token.mint] =
                    setInterval(async () => {
                      try {
                        // Fetch latest metrics
                        const metricsRes = await fetch(
                          `${import.meta.env.VITE_API_BASE_URL}/api/tokens/${
                            data.token.mint
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
                            buyUntilReachedIntervals.current[data.token.mint]
                          );
                          delete buyUntilReachedIntervals.current[
                            data.token.mint
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
                            mintAddress: data.token.mint,
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
        alert("Buy order placed successfully!");
        setBuyAmounts((prev) => ({
          ...prev,
          [data.details.mint]: "",
        }));
        // Show snackbar if this was an auto buy
        if (lastAutoBuyMint && data.details.mint === lastAutoBuyMint) {
          setAutoBuySnackbar({
            open: true,
            message: "Auto buy order successful!",
          });
          setLastAutoBuyMint(null);
        }
      }
      if (data.type === "MANUAL_BUY_ERROR") {
        alert("Buy failed: " + (data.error || "Unknown error"));
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
        alert("Sell order placed successfully!");
        // Optionally refresh user tokens or update UI
      }
      if (data.type === "MANUAL_SELL_ERROR") {
        alert("Sell failed: " + (data.error || "Unknown error"));
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

  const handleTrailingStopLossChange = (mint: string, value: string) => {
    setTrailingStopLossState((prev) => ({
      ...prev,
      [mint]: value,
    }));

    if (autoSellEnabledState[mint]) {
      if (!walletAddress) {
        alert("Wallet address not loaded. Please refresh or re-login.");
        return;
      }
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find((t) => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(takeProfitState[mint]) || undefined,
        stopLoss: Number(stopLossState[mint]) || undefined,
        autoSellPercent: Number(autoSellPercentState[mint]) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find((t) => t.mint)?.name,
        tokenSymbol: userTokens.find((t) => t.mint)?.symbol,
        trailingStopLossPercent: Number(value) || 10,
        trailingStopLossEnabled:
          trailingStopLossEnabledState[mint] !== undefined
            ? trailingStopLossEnabledState[mint]
            : false,
      };
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  };

  const handleTrailingStopLossEnabledChange = (
    mint: string,
    checked: boolean
  ) => {
    setTrailingStopLossEnabledState((prev) => ({
      ...prev,
      [mint]: checked,
    }));

    if (autoSellEnabledState[mint]) {
      if (!walletAddress) {
        alert("Wallet address not loaded. Please refresh or re-login.");
        return;
      }
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find((t) => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(takeProfitState[mint]) || undefined,
        stopLoss: Number(stopLossState[mint]) || undefined,
        autoSellPercent: Number(autoSellPercentState[mint]) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find((t) => t.mint)?.name,
        tokenSymbol: userTokens.find((t) => t.mint)?.symbol,
        trailingStopLossPercent: Number(trailingStopLossState[mint]) || 10,
        trailingStopLossEnabled: checked,
      };
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  };

  const handleTimeBasedSellChange = (mint: string, value: string) => {
    setTimeBasedSellState((prev) => ({ ...prev, [mint]: value }));
    if (autoSellEnabledState[mint]) {
      if (!walletAddress) {
        alert("Wallet address not loaded. Please refresh or re-login.");
        return;
      }
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find((t) => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(takeProfitState[mint]) || undefined,
        stopLoss: Number(stopLossState[mint]) || undefined,
        autoSellPercent: Number(autoSellPercentState[mint]) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find((t) => t.mint)?.name,
        tokenSymbol: userTokens.find((t) => t.mint)?.symbol,
        trailingStopLossPercent: Number(trailingStopLossState[mint]) || 10,
        trailingStopLossEnabled:
          trailingStopLossEnabledState[mint] !== undefined
            ? trailingStopLossEnabledState[mint]
            : false,
        timeBasedSellSec: Number(value) || 0,
        timeBasedSellEnabled:
          timeBasedSellEnabledState[mint] !== undefined
            ? timeBasedSellEnabledState[mint]
            : false,
        waitForBuyersBeforeSell: Number(waitForBuyersState[mint]) || 5,
        waitForBuyersBeforeSellEnabled:
          waitForBuyersEnabledState[mint] !== undefined
            ? waitForBuyersEnabledState[mint]
            : false,
      };
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  };

  const handleTimeBasedSellEnabledChange = (mint: string, checked: boolean) => {
    setTimeBasedSellEnabledState((prev) => ({ ...prev, [mint]: checked }));
    if (autoSellEnabledState[mint]) {
      if (!walletAddress) {
        alert("Wallet address not loaded. Please refresh or re-login.");
        return;
      }
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find((t) => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(takeProfitState[mint]) || undefined,
        stopLoss: Number(stopLossState[mint]) || undefined,
        autoSellPercent: Number(autoSellPercentState[mint]) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find((t) => t.mint)?.name,
        tokenSymbol: userTokens.find((t) => t.mint)?.symbol,
        trailingStopLossPercent: Number(trailingStopLossState[mint]) || 10,
        trailingStopLossEnabled:
          trailingStopLossEnabledState[mint] !== undefined
            ? trailingStopLossEnabledState[mint]
            : false,
        timeBasedSellSec: Number(timeBasedSellState[mint]) || 0,
        timeBasedSellEnabled: checked,
        waitForBuyersBeforeSell: Number(waitForBuyersState[mint]) || 5,
        waitForBuyersBeforeSellEnabled: checked,
      };
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  };

  const handleWaitForBuyersChange = (mint: string, value: string) => {
    setWaitForBuyersState((prev) => ({ ...prev, [mint]: value }));
    if (autoSellEnabledState[mint]) {
      if (!walletAddress) {
        alert("Wallet address not loaded. Please refresh or re-login.");
        return;
      }
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find((t) => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(takeProfitState[mint]) || undefined,
        stopLoss: Number(stopLossState[mint]) || undefined,
        autoSellPercent: Number(autoSellPercentState[mint]) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find((t) => t.mint)?.name,
        tokenSymbol: userTokens.find((t) => t.mint)?.symbol,
        trailingStopLossPercent: Number(trailingStopLossState[mint]) || 10,
        trailingStopLossEnabled:
          trailingStopLossEnabledState[mint] !== undefined
            ? trailingStopLossEnabledState[mint]
            : false,
        timeBasedSellSec: Number(timeBasedSellState[mint]) || 0,
        timeBasedSellEnabled:
          timeBasedSellEnabledState[mint] !== undefined
            ? timeBasedSellEnabledState[mint]
            : false,
        waitForBuyersBeforeSell: Number(value) || 5,
        waitForBuyersBeforeSellEnabled:
          waitForBuyersEnabledState[mint] !== undefined
            ? waitForBuyersEnabledState[mint]
            : false,
      };
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  };

  const handleWaitForBuyersEnabledChange = (mint: string, checked: boolean) => {
    setWaitForBuyersEnabledState((prev) => ({ ...prev, [mint]: checked }));
    if (autoSellEnabledState[mint]) {
      if (!walletAddress) {
        alert("Wallet address not loaded. Please refresh or re-login.");
        return;
      }
      const preset = sellPresets[activeSellPreset] || {};
      const payload = {
        userId,
        walletAddress,
        mint,
        buyPrice: userTokens.find((t) => t.mint === mint)?.buyAmount || 0,
        takeProfit: Number(takeProfitState[mint]) || undefined,
        stopLoss: Number(stopLossState[mint]) || undefined,
        autoSellPercent: Number(autoSellPercentState[mint]) || 100,
        autoSellEnabled: true,
        slippage: preset.slippage || 5,
        priorityFee: preset.priorityFee || 0.001,
        bribeAmount: preset.bribeAmount || 0,
        tokenName: userTokens.find((t) => t.mint)?.name,
        tokenSymbol: userTokens.find((t) => t.mint)?.symbol,
        trailingStopLossPercent: Number(trailingStopLossState[mint]) || 10,
        trailingStopLossEnabled:
          trailingStopLossEnabledState[mint] !== undefined
            ? trailingStopLossEnabledState[mint]
            : false,
        timeBasedSellSec: Number(timeBasedSellState[mint]) || 0,
        timeBasedSellEnabled:
          timeBasedSellEnabledState[mint] !== undefined
            ? timeBasedSellEnabledState[mint]
            : false,
        waitForBuyersBeforeSell: Number(waitForBuyersState[mint]) || 5,
        waitForBuyersBeforeSellEnabled: checked,
      };
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      fetch(`${API_URL}/api/auto-sell/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  };

  return (
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
      {/* Wallet details + Logout (below the fixed bar) */}
      {/* {walletAddress && (
        <span style={{ color: '#FFD700', fontWeight: 600, fontSize: 16, marginLeft: 16 }}>
          💰 {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
        </span>
      )} */}
      <Snackbar
        open={autoBuySnackbar.open}
        autoHideDuration={4000}
        onClose={() => setAutoBuySnackbar({ open: false, message: "" })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setAutoBuySnackbar({ open: false, message: "" })}
          severity="success"
          sx={{ width: "100%" }}
        >
          {autoBuySnackbar.message}
        </Alert>
      </Snackbar>

      {/* Main content wrapper */}
      <div className={styles.container}>
        {/* Filter Bar */}

        {/* Main Header with Toggle */}
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

        {showMyTokens ? (
          /* MY TOKENS VIEW */
          <div className={styles.tokenGrid}>
            {sortedUserTokens.length === 0 ? (
              <div className={styles.noTokensMessage}>
                You don't have any tokens yet
              </div>
            ) : (
              sortedUserTokens.map((token) => {
                const buyPrice = token.buyAmount;
                const currentPrice = token.currentPrice;
                const profitLoss = getProfitLossPercent(buyPrice, currentPrice);
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
                    style={{ position: "relative" }}
                  >
                    {/* Auto Sell Toggle */}
                    <div
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 12,
                        zIndex: 2,
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!autoSellEnabledState[token.mint]}
                            onChange={() => handleAutoSellToggle(token)}
                            color="primary"
                            size="small"
                          />
                        }
                        label="Auto Sell"
                        labelPlacement="start"
                        sx={{ color: "#FFD700", fontWeight: 500, fontSize: 13 }}
                      />
                    </div>

                    {token.imageUrl && (
                      <div className={styles.tokenImageContainer}>
                        <img
                          src={token.imageUrl}
                          alt={token.name}
                          className={styles.tokenImage}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    )}

                    <div className={styles.tokenName}>{token.name}</div>
                    <div className={styles.tokenSymbol}>{token.symbol}</div>
                    <div className={styles.tokenCreator}>
                      Creator: {token.creator || token.devAddress || "-"}
                    </div>
                    <div className={styles.tokenMint}>
                      Mint: {token.mint.substring(0, 8)}...
                      {token.mint.substring(token.mint.length - 8)}
                    </div>
                    <div className={styles.tokenAge}>
                      Age: {getAgeString(now - token.creationTimestamp)}
                    </div>

                    {token.currentPrice !== undefined && (
                      <div className={styles.tokenPrice}>
                        Price: ${toFullDecimalString(token.currentPrice)}
                      </div>
                    )}

                    {/* Token Metrics */}
                    <div className={styles.tokenMetrics}>
                      <div>
                        Balance: {token.balance} {token.symbol}
                      </div>
                      <div>Buy Price: {buyPrice ? `$${buyPrice}` : "-"}</div>
                      <div>
                        Current Price: {currentPrice ? `$${currentPrice}` : "-"}
                      </div>
                      <div>
                        Last Updated:{" "}
                        {token.lastUpdated
                          ? new Date(token.lastUpdated).toLocaleString()
                          : "-"}
                      </div>
                      <div style={{ color: profitLossColor }}>
                        P/L: {profitLoss > 0 ? "+" : ""}
                        {profitLoss.toFixed(2)}%
                      </div>
                    </div>

                    {token.buyTime && (
                      <div className={styles.tokenBuyTime}>
                        Bought: {new Date(token.buyTime).toLocaleString()}
                      </div>
                    )}

                    {/* Buy/Sell Controls */}
                    <div className={styles.buyControls}>
                      <TextField
                        label="Amount (SOL)"
                        type="number"
                        variant="outlined"
                        size="small"
                        value={buyAmounts[token.mint] || ""}
                        onChange={(e) =>
                          handleBuyAmountChange(token.mint, e.target.value)
                        }
                        className={styles.amountInput}
                      />
                      <Button
                        variant="contained"
                        className={styles.buyButton}
                        onClick={() => handleBuyClick(token)}
                      >
                        Buy
                      </Button>
                    </div>

                    <div className={styles.sellControls}>
                      <select
                        value={sellPercentsState[token.mint] || 100}
                        onChange={(e) =>
                          handleSellPercentChange(
                            token.mint,
                            Number(e.target.value)
                          )
                        }
                        className={styles.sellPercentSelect}
                      >
                        {sellPercents.map((p) => (
                          <option key={p} value={p}>
                            {p}%
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outlined"
                        className={styles.sellButton}
                        onClick={() => handleSellClick(token)}
                      >
                        Sell
                      </Button>
                    </div>

                    {/* Trading Controls */}
                    <div className={styles.tradingControls}>
                      <input
                        type="number"
                        placeholder="Take Profit"
                        value={takeProfitState[token.mint] || ""}
                        onChange={(e) =>
                          handleTakeProfitChange(token.mint, e.target.value)
                        }
                        className={styles.tradingInput}
                        style={{
                          border:
                            !autoSellEnabledState[token.mint] ||
                            !!timeBasedSellEnabledState[token.mint]
                              ? "1px solid #555"
                              : "1px solid #FFD700",
                          color:
                            !autoSellEnabledState[token.mint] ||
                            !!timeBasedSellEnabledState[token.mint]
                              ? "#888"
                              : "white",
                        }}
                        disabled={
                          !autoSellEnabledState[token.mint] ||
                          !!timeBasedSellEnabledState[token.mint]
                        }
                      />
                      <input
                        type="number"
                        placeholder="Stop Loss %"
                        value={stopLossState[token.mint] || ""}
                        onChange={(e) =>
                          handleStopLossChange(token.mint, e.target.value)
                        }
                        className={styles.tradingInput}
                        style={{
                          border:
                            !autoSellEnabledState[token.mint] ||
                            !!trailingStopLossEnabledState[token.mint] ||
                            !!timeBasedSellEnabledState[token.mint]
                              ? "1px solid #555"
                              : "1px solid #ff6b6b",
                          color:
                            !autoSellEnabledState[token.mint] ||
                            !!trailingStopLossEnabledState[token.mint] ||
                            !!timeBasedSellEnabledState[token.mint]
                              ? "#888"
                              : "white",
                        }}
                        disabled={
                          !autoSellEnabledState[token.mint] ||
                          !!trailingStopLossEnabledState[token.mint] ||
                          !!timeBasedSellEnabledState[token.mint]
                        }
                      />
                      <input
                        type="number"
                        placeholder="Auto Sell %"
                        value={autoSellPercentState[token.mint] || ""}
                        onChange={(e) =>
                          handleAutoSellPercentChange(
                            token.mint,
                            e.target.value
                          )
                        }
                        className={styles.tradingInput}
                        style={{
                          border: !autoSellEnabledState[token.mint]
                            ? "1px solid #555"
                            : "1px solid #00BFFF",
                          color: !autoSellEnabledState[token.mint]
                            ? "#888"
                            : "white",
                        }}
                        disabled={!autoSellEnabledState[token.mint]}
                      />
                    </div>

                    {/* Advanced Controls */}
                    <div className={styles.trailingStopLossControls}>
                      <TextField
                        label="Trailing Stop Loss (%)"
                        type="number"
                        variant="outlined"
                        size="small"
                        className={styles.trailingStopLossInput}
                        value={trailingStopLossState[token.mint] || ""}
                        onChange={(e) =>
                          handleTrailingStopLossChange(
                            token.mint,
                            e.target.value
                          )
                        }
                        disabled={
                          !autoSellEnabledState[token.mint] ||
                          !trailingStopLossEnabledState[token.mint] ||
                          !!timeBasedSellEnabledState[token.mint]
                        }
                      />
                      <label
                        className={styles.checkboxLabel}
                        style={{
                          color:
                            !autoSellEnabledState[token.mint] ||
                            !!timeBasedSellEnabledState[token.mint]
                              ? "#888"
                              : "#FFD700",
                        }}
                      >
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={!!trailingStopLossEnabledState[token.mint]}
                          onChange={(e) =>
                            handleTrailingStopLossEnabledChange(
                              token.mint,
                              e.target.checked
                            )
                          }
                          disabled={
                            !autoSellEnabledState[token.mint] ||
                            !!timeBasedSellEnabledState[token.mint]
                          }
                        />
                        On/Off
                      </label>
                    </div>

                    <div className={styles.waitForBuyersControls}>
                      <TextField
                        label="Wait for Buyers Before Sell"
                        type="number"
                        variant="outlined"
                        size="small"
                        className={styles.waitForBuyersInput}
                        value={waitForBuyersState[token.mint] || ""}
                        onChange={(e) =>
                          handleWaitForBuyersChange(token.mint, e.target.value)
                        }
                        disabled={
                          !autoSellEnabledState[token.mint] ||
                          !waitForBuyersEnabledState[token.mint]
                        }
                      />
                      <label
                        className={styles.checkboxLabel}
                        style={{
                          color: !autoSellEnabledState[token.mint]
                            ? "#888"
                            : "#FFD700",
                        }}
                      >
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={!!waitForBuyersEnabledState[token.mint]}
                          onChange={(e) =>
                            handleWaitForBuyersEnabledChange(
                              token.mint,
                              e.target.checked
                            )
                          }
                          disabled={!autoSellEnabledState[token.mint]}
                        />
                        On/Off
                      </label>
                    </div>

                    <div className={styles.timeBasedSellControls}>
                      <TextField
                        label="Time-Based Sell (sec)"
                        type="number"
                        variant="outlined"
                        size="small"
                        className={styles.timeBasedSellInput}
                        value={timeBasedSellState[token.mint] || ""}
                        onChange={(e) =>
                          handleTimeBasedSellChange(token.mint, e.target.value)
                        }
                        disabled={
                          !autoSellEnabledState[token.mint] ||
                          !timeBasedSellEnabledState[token.mint]
                        }
                      />
                      <label
                        className={styles.checkboxLabel}
                        style={{
                          color: !autoSellEnabledState[token.mint]
                            ? "#888"
                            : "#FFD700",
                        }}
                      >
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={!!timeBasedSellEnabledState[token.mint]}
                          onChange={(e) =>
                            handleTimeBasedSellEnabledChange(
                              token.mint,
                              e.target.checked
                            )
                          }
                          disabled={!autoSellEnabledState[token.mint]}
                        />
                        On/Off
                      </label>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* ALL TOKENS VIEW (with age-based sections) */
          <div className={styles.tokenSectionsContainer}>
            {/* Section 1: Tokens <= 24h */}
            <div className={styles.tokenSection}>
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
                      {token.imageUrl && (
                        <div className={styles.tokenImageContainer}>
                          <img
                            src={token.imageUrl}
                            alt={token.name}
                            className={styles.tokenImage}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                      )}

                      <div className={styles.tokenName}>{token.name}</div>
                      <div className={styles.tokenSymbol}>{token.symbol}</div>
                      <div className={styles.tokenCreator}>
                        Creator: {token.creator || token.devAddress || "-"}
                      </div>
                      <div className={styles.tokenMint}>
                        Mint: {token.mint.substring(0, 8)}...
                        {token.mint.substring(token.mint.length - 8)}
                      </div>
                      <div className={styles.tokenAge}>
                        Age: {getAgeString(now - token.creationTimestamp)}
                      </div>

                      {token.currentPrice !== undefined && (
                        <div className={styles.tokenPrice}>
                          Price: ${toFullDecimalString(token.currentPrice)}
                        </div>
                      )}

                      <div className={styles.buyControls}>
                        <TextField
                          label="Amount (SOL)"
                          type="number"
                          variant="outlined"
                          size="small"
                          value={buyAmounts[token.mint] || ""}
                          onChange={(e) =>
                            handleBuyAmountChange(token.mint, e.target.value)
                          }
                          className={styles.amountInput}
                        />
                        <Button
                          variant="contained"
                          className={styles.buyButton}
                          onClick={() => handleBuyClick(token)}
                        >
                          Buy
                        </Button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Section 2: Tokens 24h-48h */}
            <div className={styles.tokenSection}>
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
                {filterTokensByAge(sortedTokens, 24, 48, sortOrder24_48h).map(
                  (token) => (
                    <div
                      key={token.mint}
                      className={styles.tokenCard}
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
                      {token.imageUrl && (
                        <div className={styles.tokenImageContainer}>
                          <img
                            src={token.imageUrl}
                            alt={token.name}
                            className={styles.tokenImage}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                      )}

                      <div className={styles.tokenName}>{token.name}</div>
                      <div className={styles.tokenSymbol}>{token.symbol}</div>
                      <div className={styles.tokenCreator}>
                        Creator: {token.creator || token.devAddress || "-"}
                      </div>
                      <div className={styles.tokenMint}>
                        Mint: {token.mint.substring(0, 8)}...
                        {token.mint.substring(token.mint.length - 8)}
                      </div>
                      <div className={styles.tokenAge}>
                        Age: {getAgeString(now - token.creationTimestamp)}
                      </div>

                      {token.currentPrice !== undefined && (
                        <div className={styles.tokenPrice}>
                          Price: ${toFullDecimalString(token.currentPrice)}
                        </div>
                      )}

                      <div className={styles.buyControls}>
                        <TextField
                          label="Amount (SOL)"
                          type="number"
                          variant="outlined"
                          size="small"
                          value={buyAmounts[token.mint] || ""}
                          onChange={(e) =>
                            handleBuyAmountChange(token.mint, e.target.value)
                          }
                          className={styles.amountInput}
                        />
                        <Button
                          variant="contained"
                          className={styles.buyButton}
                          onClick={() => handleBuyClick(token)}
                        >
                          Buy
                        </Button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Section 3: Tokens > 48h */}
            <div className={styles.tokenSection}>
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
                    {token.imageUrl && (
                      <div className={styles.tokenImageContainer}>
                        <img
                          src={token.imageUrl}
                          alt={token.name}
                          className={styles.tokenImage}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    )}

                    <div className={styles.tokenName}>{token.name}</div>
                    <div className={styles.tokenSymbol}>{token.symbol}</div>
                    <div className={styles.tokenCreator}>
                      Creator: {token.creator || token.devAddress || "-"}
                    </div>
                    <div className={styles.tokenMint}>
                      Mint: {token.mint.substring(0, 8)}...
                      {token.mint.substring(token.mint.length - 8)}
                    </div>
                    <div className={styles.tokenAge}>
                      Age: {getAgeString(now - token.creationTimestamp)}
                    </div>

                    {token.currentPrice !== undefined && (
                      <div className={styles.tokenPrice}>
                        Price: ${toFullDecimalString(token.currentPrice)}
                      </div>
                    )}

                    <div className={styles.buyControls}>
                      <TextField
                        label="Amount (SOL)"
                        type="number"
                        variant="outlined"
                        size="small"
                        value={buyAmounts[token.mint] || ""}
                        onChange={(e) =>
                          handleBuyAmountChange(token.mint, e.target.value)
                        }
                        className={styles.amountInput}
                      />
                      <Button
                        variant="contained"
                        className={styles.buyButton}
                        onClick={() => handleBuyClick(token)}
                      >
                        Buy
                      </Button>
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

      {/* Global withdraw notification */}
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
    </>
  );
};

export default TokenListWithAge;

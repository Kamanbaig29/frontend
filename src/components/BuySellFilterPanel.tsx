import React, { useState, useEffect, useRef } from "react";

// Define the filter types for type safety
export interface BuyFilters {
  amount?: string;
  slippage?: string;
  priorityFee?: string;
  bribeAmount?: string;
  maxMcap?: string;
  maxBuyers?: string;
  maxTokenAge?: string;
  antiRug?: boolean;
  minLpLockTime?: string;
  whitelistDevs?: string;
  blacklistDevs?: string;
  autoSellCondition?: string;
  noBribeMode?: boolean;
  timeout?: string;
  _whitelistDevsInput?: string; // Added for the new multi-select input
  buyUntilReached?: boolean;
  buyUntilMarketCap?: string;
  buyUntilPrice?: string;
  buyUntilAmount?: string;
}

export interface SellFilters {
  takeProfitPercent?: string;
  stopLossPercent?: string;
  trailingStopPercent?: string;
  timeoutSellAfterSec?: string;
  sellPercent?: string;
  minLiquidity?: string;
  frontRunProtection?: boolean;
  sellPriorityFee?: string;
  waitForBuyersBeforeSell?: string;
  blockedTokens?: string;
  loopSellLogic?: boolean;
}

interface BuySellFilterPanelProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  buyFilters: BuyFilters;
  sellFilters: SellFilters;
  onChangeBuyFilters: (filters: BuyFilters) => void;
  onChangeSellFilters: (filters: SellFilters) => void;
}

const inputStyle = {
  background: "#23242a",
  color: "#FFD700",
  border: "1px solid #FFD700",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 16,
  marginLeft: 8,
  minWidth: 180
};

const InfoIcon: React.FC<{ tip: string }> = ({ tip }) => {
  const [show, setShow] = React.useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-block", marginLeft: 6 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
    >
      <span
        style={{
          display: "inline-block",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#FFD70022",
          color: "#FFD700",
          fontWeight: 700,
          fontSize: 12,
          textAlign: "center",
          lineHeight: "16px",
          cursor: "pointer",
          opacity: 0.7,
          border: "1px solid #FFD70055"
        }}
      >
        i
      </span>
      {show && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "120%",
            width: 260,
            background: "#23242a",
            color: "#FFD700",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 13,
            zIndex: 10000,
            boxShadow: "0 2px 8px #0008",
            whiteSpace: "normal",
            textAlign: "left",
            marginTop: 4,
            maxWidth: "90vw",
            minWidth: 180,
            pointerEvents: "none"
          }}
        >
          {tip}
        </div>
      )}
    </span>
  );
};

const BuySellFilterPanel: React.FC<BuySellFilterPanelProps> = ({
  open,
  onClose,
  //userId,
  buyFilters,
  sellFilters,
  onChangeBuyFilters,
  onChangeSellFilters
}) => {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");

  // --- Whitelist Devs Dropdown State ---
  const [whitelistDevsDropdownOpen, setWhitelistDevsDropdownOpen] = useState(false);
  const [whitelistDevs, setWhitelistDevs] = useState<string[]>(["true"]);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistInput, setWhitelistInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Add error state for whitelist/blacklist conflicts ---
  const [whitelistError, setWhitelistError] = useState("");
  const [blacklistError, setBlacklistError] = useState("");

  // Fetch whitelist devs from backend
  const fetchWhitelistDevs = async () => {
    setWhitelistLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user-filters/whitelist-devs`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setWhitelistDevs(data.whitelistDevs || ["true"]);
    } catch {
      setWhitelistDevs(["true"]);
    }
    setWhitelistLoading(false);
  };

  // Open dropdown: fetch devs
  useEffect(() => {
    if (whitelistDevsDropdownOpen) fetchWhitelistDevs();
  }, [whitelistDevsDropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!whitelistDevsDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setWhitelistDevsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [whitelistDevsDropdownOpen]);

  // Add dev (whitelist)
  const handleAddDev = async () => {
    const address = whitelistInput.trim();
    if (!address || whitelistDevs.includes(address)) return;
    if (blacklistDevs.includes(address)) {
      setWhitelistError("Address already in blacklist. Remove from blacklist first.");
      return;
    }
    setWhitelistLoading(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user-filters/whitelist-devs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ address })
      });
      setWhitelistInput("");
      fetchWhitelistDevs();
    } catch {}
    setWhitelistLoading(false);
  };

  // Remove dev
  const handleRemoveDev = async (address: string) => {
    setWhitelistLoading(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user-filters/whitelist-devs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ address })
      });
      fetchWhitelistDevs();
    } catch {}
    setWhitelistLoading(false);
  };

  // Placeholder logic
  const realDevs = whitelistDevs.filter((d) => d !== "true");
  const whitelistPlaceholder =
    whitelistDevs.length === 1 && whitelistDevs[0] === "true"
      ? "true"
      : `Whitelist: ${realDevs.length} dev${realDevs.length === 1 ? "" : "s"}`;

  // --- Blacklist Devs Dropdown State ---
  const [blacklistDevsDropdownOpen, setBlacklistDevsDropdownOpen] = useState(false);
  const [blacklistDevs, setBlacklistDevs] = useState<string[]>([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistInput, setBlacklistInput] = useState("");
  const blacklistDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch blacklist devs from backend
  const fetchBlacklistDevs = async () => {
    setBlacklistLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user-filters/blacklist-devs`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setBlacklistDevs(data.blacklistDevs || []);
    } catch {
      setBlacklistDevs([]);
    }
    setBlacklistLoading(false);
  };

  // Fetch blacklist devs when the filter panel opens
  useEffect(() => {
    if (open) fetchBlacklistDevs();
    // eslint-disable-next-line
  }, [open]);

  // Open dropdown: fetch devs
  useEffect(() => {
    if (blacklistDevsDropdownOpen) fetchBlacklistDevs();
  }, [blacklistDevsDropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!blacklistDevsDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (blacklistDropdownRef.current && !blacklistDropdownRef.current.contains(e.target as Node)) {
        setBlacklistDevsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [blacklistDevsDropdownOpen]);

  // Add dev
  const handleAddBlacklistDev = async () => {
    const address = blacklistInput.trim();
    if (!address || blacklistDevs.includes(address)) return;
    if (whitelistDevs.includes(address)) {
      setBlacklistError("Address already in whitelist. Remove from whitelist first.");
      return;
    }
    setBlacklistLoading(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user-filters/blacklist-devs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ address })
      });
      setBlacklistInput("");
      fetchBlacklistDevs();
    } catch {}
    setBlacklistLoading(false);
  };

  // Remove dev
  const handleRemoveBlacklistDev = async (address: string) => {
    setBlacklistLoading(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user-filters/blacklist-devs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ address })
      });
      fetchBlacklistDevs();
    } catch {}
    setBlacklistLoading(false);
  };

  const realBlacklistDevs = blacklistDevs.filter((d) => d !== "true");
  const blacklistPlaceholder =
    blacklistDevs.length === 1 && blacklistDevs[0] === "true"
      ? "true"
      : realBlacklistDevs.length === 0
        ? "No devs blacklisted"
        : `Blacklist: ${realBlacklistDevs.length} dev${realBlacklistDevs.length === 1 ? "" : "s"}`;

  // Fetch whitelist devs when the filter panel opens
  useEffect(() => {
    if (open) fetchWhitelistDevs();
    // eslint-disable-next-line
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fetchBuyFilters = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user-filters/buy-filters`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.buyFilters) {
          onChangeBuyFilters({ ...buyFilters, ...data.buyFilters });
        }
      } catch (e) {
        // Optionally handle error
      }
    };
    fetchBuyFilters();
    // eslint-disable-next-line
  }, [open]);

  if (!open) return null;

  // Update handleBuyFilterChange to accept any field and value
  const handleBuyFilterChange = async (field: string, value: any) => {
    onChangeBuyFilters({ ...buyFilters, [field]: value });
    try {
      const token = localStorage.getItem("token");
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user-filters/buy-filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ field, value }),
      });
    } catch (e) {
      // Optionally show error
    }
  };

  return (
    <>
      {open && (
        <>
          {/* Blurred backdrop */}
          <div
            style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(4px)",
              zIndex: 9998
            }}
            onClick={onClose}
          />
          {/* Modal */}
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 9999,
              background: "#18181b",
              color: "#FFD700",
              borderRadius: 18,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              padding: 32,
              minWidth: 400,
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflowY: "auto",
              fontFamily: "inherit"
            }}
          >
            {/* Dev notice */}
            <div style={{
              color: '#FFD700',
              background: 'rgba(255, 215, 0, 0.08)',
              fontSize: 13,
              textAlign: 'center',
              marginBottom: 10,
              borderRadius: 6,
              padding: '4px 0',
              letterSpacing: 0.2,
              fontWeight: 500
            }}>
              This feature is in development, not in build
            </div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
              <button
                style={{
                  flex: 1,
                  padding: "12px 0",
                  fontWeight: 700,
                  fontSize: 20,
                  background: activeTab === "buy" ? "#23242a" : "transparent",
                  color: activeTab === "buy" ? "#FFD700" : "#fff",
                  border: "none",
                  borderBottom: activeTab === "buy" ? "3px solid #FFD700" : "3px solid transparent",
                  cursor: "pointer",
                  borderRadius: 12,
                  transition: "all 0.2s"
                }}
                onClick={() => setActiveTab("buy")}
              >
                🛒 Buy Filters
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "12px 0",
                  fontWeight: 700,
                  fontSize: 20,
                  background: activeTab === "sell" ? "#23242a" : "transparent",
                  color: activeTab === "sell" ? "#FFD700" : "#fff",
                  border: "none",
                  borderBottom: activeTab === "sell" ? "3px solid #FFD700" : "3px solid transparent",
                  cursor: "pointer",
                  borderRadius: 12,
                  transition: "all 0.2s"
                }}
                onClick={() => setActiveTab("sell")}
              >
                💸 Sell Filters
              </button>
              <button
                onClick={onClose}
                style={{
                  marginLeft: 16,
                  background: "none",
                  border: "none",
                  color: "#fff",
                  fontSize: 28,
                  cursor: "pointer"
                }}
              >
                ×
              </button>
            </div>
            {/* Animated filter content */}
            {activeTab === "buy" && (
              <div style={{ width: "100%", transition: "all 0.4s" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  
                  
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Max Market Cap:
                      <InfoIcon tip="Only buy tokens with a market cap below this value. Use this to avoid entering overhyped or already pumped tokens." />
                    </span>
                    <input
                      type="number"
                      value={buyFilters.maxMcap || ""}
                      onChange={e => handleBuyFilterChange('maxMcap', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Max Buyers:
                      <InfoIcon tip="Only buy tokens with fewer buyers than this value. Helps you get in early before the crowd." />
                    </span>
                    <input
                      type="number"
                      value={buyFilters.maxBuyers || ""}
                      onChange={e => handleBuyFilterChange('maxBuyers', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Max Token Age (sec):
                      <InfoIcon tip="Only buy tokens created within this number of seconds. Useful for sniping new launches." />
                    </span>
                    <input type="number" value={buyFilters.maxTokenAge || ""} onChange={e => handleBuyFilterChange('maxTokenAge', e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ minWidth: 180, color: "#fff" }}>
                        Anti-Rug:
                        <InfoIcon tip="Enable to skip tokens with suspicious liquidity or developer activity. Helps avoid scams and rug pulls." />
                      </span>
                      <input type="checkbox" checked={!!buyFilters.antiRug} onChange={e => handleBuyFilterChange('antiRug', e.target.checked)} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ minWidth: 180, color: "#fff" }}>
                        No Bribe Mode:
                        <InfoIcon tip="Enable to avoid sending bribes in buy transactions. Use if you want to avoid extra costs, but may miss early access." />
                      </span>
                      <input type="checkbox" checked={!!buyFilters.noBribeMode} onChange={e => handleBuyFilterChange('noBribeMode', e.target.checked)} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      LP Lock Time (min):
                      <InfoIcon tip="Only buy tokens whose liquidity pool is locked for at least this many minutes. Reduces risk of rug pulls." />
                    </span>
                    <input type="number" value={buyFilters.minLpLockTime || ""} onChange={e => handleBuyFilterChange('minLpLockTime', e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Whitelist Devs:
                      <InfoIcon tip="Only buy tokens if the developer address is in this list. Use to support trusted devs." />
                    </span>
                    {/* --- NEW: Dropdown for Whitelist Devs --- */}
                    <div style={{ position: 'relative', minWidth: 220, maxWidth: 260 }} ref={dropdownRef}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          background: '#23242a',
                          border: '1px solid #FFD700',
                          borderRadius: 8,
                          padding: '6px 8px',
                          minHeight: 40,
                          cursor: 'pointer',
                          color: '#FFD700',
                          fontSize: 15,
                          userSelect: 'none',
                          width: 220, // Match other input fields
                          boxSizing: 'border-box',
                        }}
                        onClick={() => setWhitelistDevsDropdownOpen((v) => !v)}
                      >
                        <span style={{ opacity: realDevs.length === 0 ? 0.7 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                          {whitelistPlaceholder}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: 18, color: '#FFD700' }}>
                          ▼
                        </span>
                      </div>
                      {whitelistDevsDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '110%',
                            left: 0,
                            zIndex: 100,
                            background: '#18181b',
                            border: '1px solid #FFD700',
                            borderRadius: 8,
                            minWidth: 220,
                            maxWidth: 260,
                            boxShadow: '0 4px 16px #000a',
                            padding: 10,
                            marginTop: 4,
                            boxSizing: 'border-box',
                          }}
                        >
                          {whitelistLoading ? (
                            <div style={{ color: '#FFD700', textAlign: 'center', padding: 8 }}>Loading...</div>
                          ) : (
                            <>
                              {realDevs.length === 0 && (
                                <div style={{ color: '#FFD70088', textAlign: 'center', padding: 8 }}>No devs whitelisted</div>
                              )}
                              {realDevs.length > 0 && (
                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 6,
                                  marginBottom: 8,
                                  maxHeight: 60,
                                  overflowY: 'auto',
                                }}>
                                  {realDevs.map((dev) => (
                                    <span
                                      key={dev}
                                      style={{
                                        background: '#FFD70022',
                                        color: '#FFD700',
                                        borderRadius: 5,
                                        padding: '1px 6px 1px 6px',
                                        fontSize: 12,
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        maxWidth: 180, // Increased width
                                        minWidth: 0,
                                        whiteSpace: 'nowrap',
                                        textOverflow: 'ellipsis',
                                        overflow: 'visible', // Allow icon to show
                                        position: 'relative',
                                      }}
                                      title={dev}
                                    >
                                      <span
                                        style={{
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: 120,
                                          display: 'inline-block',
                                        }}
                                      >
                                        {dev}
                                      </span>
                                      <span
                                        style={{
                                          cursor: 'pointer',
                                          marginLeft: 6,
                                          fontSize: 15,
                                          fontWeight: 700,
                                          color: '#FFD700',
                                          background: 'none',
                                          border: 'none',
                                          outline: 'none',
                                          padding: 0,
                                          lineHeight: 1,
                                          display: 'inline-block',
                                        }}
                                        onClick={() => handleRemoveDev(dev)}
                                        title="Remove"
                                      >
                                        ×
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}
                              <input
                                type="text"
                                placeholder="Add address & press Enter"
                                value={whitelistInput}
                                onChange={e => {
                                  setWhitelistInput(e.target.value);
                                  setWhitelistError("");
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleAddDev();
                                }}
                                style={{
                                  background: '#23242a',
                                  border: '1px solid #FFD700',
                                  borderRadius: 6,
                                  color: '#FFD700',
                                  fontSize: 15,
                                  width: '100%',
                                  padding: '4px 8px',
                                  boxSizing: 'border-box',
                                }}
                                disabled={whitelistLoading}
                              />
                              {whitelistError && (
                                <div style={{ color: '#FFD700', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                  {whitelistError}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Blacklist Devs:
                      <InfoIcon tip="Never buy tokens if the developer address is in this list. Helps avoid known scam devs." />
                    </span>
                    {/* --- Dropdown for Blacklist Devs --- */}
                    <div style={{ position: 'relative', minWidth: 220, maxWidth: 260 }} ref={blacklistDropdownRef}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          background: '#23242a',
                          border: '1px solid #ff4d4f',
                          borderRadius: 8,
                          padding: '6px 8px',
                          minHeight: 40,
                          cursor: 'pointer',
                          color: '#ff4d4f',
                          fontSize: 15,
                          userSelect: 'none',
                          width: 220,
                          boxSizing: 'border-box',
                        }}
                        onClick={() => setBlacklistDevsDropdownOpen((v) => !v)}
                      >
                        <span style={{ opacity: blacklistDevs.length === 0 ? 0.7 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                          {blacklistPlaceholder}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: 18, color: '#ff4d4f' }}>
                          ▼
                        </span>
                      </div>
                      {blacklistDevsDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '110%',
                            left: 0,
                            zIndex: 100,
                            background: '#18181b',
                            border: '1px solid #ff4d4f',
                            borderRadius: 8,
                            minWidth: 220,
                            maxWidth: 260,
                            boxShadow: '0 4px 16px #000a',
                            padding: 10,
                            marginTop: 4,
                            boxSizing: 'border-box',
                          }}
                        >
                          {blacklistLoading ? (
                            <div style={{ color: '#ff4d4f', textAlign: 'center', padding: 8 }}>Loading...</div>
                          ) : (
                            <>
                              {realBlacklistDevs.length > 0 && (
                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 6,
                                  marginBottom: 8,
                                  maxHeight: 60,
                                  overflowY: 'auto',
                                }}>
                                  {realBlacklistDevs.map((dev) => (
                                    <span
                                      key={dev}
                                      style={{
                                        background: '#ffcccc',
                                        color: '#ff4d4f',
                                        borderRadius: 5,
                                        padding: '1px 6px 1px 6px',
                                        fontSize: 12,
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        maxWidth: 180,
                                        minWidth: 0,
                                        whiteSpace: 'nowrap',
                                        textOverflow: 'ellipsis',
                                        overflow: 'visible',
                                        position: 'relative',
                                      }}
                                      title={dev}
                                    >
                                      <span
                                        style={{
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: 120,
                                          display: 'inline-block',
                                        }}
                                      >
                                        {dev}
                                      </span>
                                      <span
                                        style={{
                                          cursor: 'pointer',
                                          marginLeft: 6,
                                          fontSize: 15,
                                          fontWeight: 700,
                                          color: '#ff4d4f',
                                          background: 'none',
                                          border: 'none',
                                          outline: 'none',
                                          padding: 0,
                                          lineHeight: 1,
                                          display: 'inline-block',
                                        }}
                                        onClick={() => handleRemoveBlacklistDev(dev)}
                                        title="Remove"
                                      >
                                        ×
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}
                              <input
                                type="text"
                                placeholder="Add address & press Enter"
                                value={blacklistInput}
                                onChange={e => {
                                  setBlacklistInput(e.target.value);
                                  setBlacklistError("");
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleAddBlacklistDev();
                                }}
                                style={{
                                  background: '#23242a',
                                  border: '1px solid #ff4d4f',
                                  borderRadius: 6,
                                  color: '#ff4d4f',
                                  fontSize: 15,
                                  width: '100%',
                                  padding: '4px 8px',
                                  boxSizing: 'border-box',
                                }}
                                disabled={blacklistLoading}
                              />
                              {blacklistError && (
                                <div style={{ color: '#ff4d4f', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                  {blacklistError}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={!!buyFilters.buyUntilReached}
                      onChange={e => handleBuyFilterChange('buyUntilReached', e.target.checked)}
                      style={{ marginRight: 8 }}
                    />
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>
                      Buy Until Reached
                      <InfoIcon tip="Enable to keep buying until one of the below conditions is met." />
                    </span>
                  </div>
                  {buyFilters.buyUntilReached && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                      {/* Market Cap */}
                      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 8 }}>
                        <span style={{ color: '#fff', fontSize: 14 }}>Market Cap</span>
                        <input
                          type="number"
                          value={buyFilters.buyUntilMarketCap || ""}
                          onChange={e => handleBuyFilterChange('buyUntilMarketCap', e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      {/* Price */}
                      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 8 }}>
                        <span style={{ color: '#fff', fontSize: 14 }}>Price</span>
                        <input
                          type="number"
                          value={buyFilters.buyUntilPrice || ""}
                          onChange={e => handleBuyFilterChange('buyUntilPrice', e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      {/* Amount */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#fff', fontSize: 14 }}>Amount</span>
                        <input
                          type="number"
                          value={buyFilters.buyUntilAmount || ""}
                          onChange={e => handleBuyFilterChange('buyUntilAmount', e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Buy Timeout (sec):
                      <InfoIcon tip="Cancel the buy transaction if it is not confirmed within this number of seconds. Prevents stuck or slow buys." />
                    </span>
                    <input type="number" value={buyFilters.timeout || ""} onChange={e => handleBuyFilterChange('timeout', e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </div>
            )}
            {activeTab === "sell" && (
              <div style={{ width: "100%", transition: "all 0.4s" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Trailing Stop Loss (%):
                      <InfoIcon tip="Sell if the price drops by this percent from its peak. Helps lock in profits during a run-up." />
                    </span>
                    <input type="number" value={sellFilters.trailingStopPercent || ""} onChange={e => onChangeSellFilters({ ...sellFilters, trailingStopPercent: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Time-Based Sell (sec):
                      <InfoIcon tip="Sell after holding the token for this many seconds, regardless of price. Useful for time-based exits." />
                    </span>
                    <input type="number" value={sellFilters.timeoutSellAfterSec || ""} onChange={e => onChangeSellFilters({ ...sellFilters, timeoutSellAfterSec: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Min Liquidity (SOL):
                      <InfoIcon tip="Only sell if the token’s liquidity pool is above this value. Helps avoid selling into low liquidity." />
                    </span>
                    <input type="number" value={sellFilters.minLiquidity || ""} onChange={e => onChangeSellFilters({ ...sellFilters, minLiquidity: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ minWidth: 180, color: "#fff" }}>
                        Front-run Protection:
                        <InfoIcon tip="Enable to avoid selling if price manipulation or front-running is detected. Adds extra safety." />
                      </span>
                      <input type="checkbox" checked={!!sellFilters.frontRunProtection} onChange={e => onChangeSellFilters({ ...sellFilters, frontRunProtection: e.target.checked })} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ minWidth: 180, color: "#fff" }}>
                        Repeatable Strategy:
                        <InfoIcon tip="Enable to automatically repeat your sell strategy after each sell. Useful for ongoing trading." />
                      </span>
                      <input type="checkbox" checked={!!sellFilters.loopSellLogic} onChange={e => onChangeSellFilters({ ...sellFilters, loopSellLogic: e.target.checked })} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Wait for Buyers Before Sell:
                      <InfoIcon tip="Only sell if there are at least this many buyers in the market. Helps avoid selling into low demand." />
                    </span>
                    <input type="number" value={sellFilters.waitForBuyersBeforeSell || ""} onChange={e => onChangeSellFilters({ ...sellFilters, waitForBuyersBeforeSell: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Blocked Tokens:
                      <InfoIcon tip="Never sell these tokens, no matter what. Use to protect specific holdings from being sold." />
                    </span>
                    <input type="text" value={sellFilters.blockedTokens || ""} onChange={e => onChangeSellFilters({ ...sellFilters, blockedTokens: e.target.value })} style={inputStyle} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default BuySellFilterPanel;

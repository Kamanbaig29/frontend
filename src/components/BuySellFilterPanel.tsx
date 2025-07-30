import React, { useState, useEffect, useRef } from "react";
import "../assets/buySellFilterModal.css"; // <— import the CSS file we provide below

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
  _whitelistDevsInput?: string;
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


const InfoIcon: React.FC<{ tip: string; className?: string }> = ({ tip, className = "" }) => {
  const [show, setShow] = React.useState(false);

  return (
    <span
      className={`info-icon-root`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
    >
      <span className="info-icon-circle">i</span>
      {show && <span className={`info-icon-tooltip ${className}`}>{tip}</span>}
    </span>
  );
};


const BuySellFilterPanel: React.FC<BuySellFilterPanelProps> = ({
  open,
  onClose,
  buyFilters,
  sellFilters,
  onChangeBuyFilters,
  onChangeSellFilters,
}) => {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");

  /* -------------------- WHITELIST STATE -------------------- */
  const [whitelistDevsDropdownOpen, setWhitelistDevsDropdownOpen] =
    useState(false);
  const [whitelistDevs, setWhitelistDevs] = useState<string[]>(["true"]);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistInput, setWhitelistInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [whitelistError, setWhitelistError] = useState("");

  /* -------------------- BLACKLIST STATE -------------------- */
  const [blacklistDevsDropdownOpen, setBlacklistDevsDropdownOpen] =
    useState(false);
  const [blacklistDevs, setBlacklistDevs] = useState<string[]>([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistInput, setBlacklistInput] = useState("");
  const [blacklistError, setBlacklistError] = useState("");
  const blacklistDropdownRef = useRef<HTMLDivElement>(null);

  /* -------------------- BLOCKED TOKENS STATE -------------------- */
  const [blockedTokensDropdownOpen, setBlockedTokensDropdownOpen] =
    useState(false);
  const [blockedTokens, setBlockedTokens] = useState<string[]>([]);
  const [blockedTokensLoading, setBlockedTokensLoading] = useState(false);
  const [blockedTokensInput, setBlockedTokensInput] = useState("");
  const blockedTokensDropdownRef = useRef<HTMLDivElement>(null);

  /* =========================================================
     BACKEND FETCH / SAVE  (100 % identical to original)
  ========================================================= */

  /* Whitelist */
  const fetchWhitelistDevs = async () => {
    setWhitelistLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/whitelist-devs`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      setWhitelistDevs(data.whitelistDevs || ["true"]);
    } catch {
      setWhitelistDevs(["true"]);
    }
    setWhitelistLoading(false);
  };
  const handleAddDev = async () => {
    const address = whitelistInput.trim();
    if (!address || whitelistDevs.includes(address)) return;
    if (blacklistDevs.includes(address)) {
      setWhitelistError(
        "Address already in blacklist. Remove from blacklist first."
      );
      return;
    }
    setWhitelistLoading(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/whitelist-devs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ address }),
        }
      );
      setWhitelistInput("");
      fetchWhitelistDevs();
    } catch { }
    setWhitelistLoading(false);
  };
  const handleRemoveDev = async (address: string) => {
    setWhitelistLoading(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/whitelist-devs`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ address }),
        }
      );
      fetchWhitelistDevs();
    } catch { }
    setWhitelistLoading(false);
  };

  /* Blacklist */
  const fetchBlacklistDevs = async () => {
    setBlacklistLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/blacklist-devs`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      setBlacklistDevs(data.blacklistDevs || []);
    } catch {
      setBlacklistDevs([]);
    }
    setBlacklistLoading(false);
  };
  const handleAddBlacklistDev = async () => {
    const address = blacklistInput.trim();
    if (!address || blacklistDevs.includes(address)) return;
    if (whitelistDevs.includes(address)) {
      setBlacklistError(
        "Address already in whitelist. Remove from whitelist first."
      );
      return;
    }
    setBlacklistLoading(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/blacklist-devs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ address }),
        }
      );
      setBlacklistInput("");
      fetchBlacklistDevs();
    } catch { }
    setBlacklistLoading(false);
  };
  const handleRemoveBlacklistDev = async (address: string) => {
    setBlacklistLoading(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/blacklist-devs`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ address }),
        }
      );
      fetchBlacklistDevs();
    } catch { }
    setBlacklistLoading(false);
  };

  /* Blocked Tokens */
  const fetchBlockedTokens = async () => {
    setBlockedTokensLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/blocked-tokens`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      setBlockedTokens(data.blockedTokens || []);
    } catch {
      setBlockedTokens([]);
    }
    setBlockedTokensLoading(false);
  };
  const handleAddBlockedToken = async () => {
    const address = blockedTokensInput.trim();
    if (!address || blockedTokens.includes(address)) return;
    setBlockedTokensLoading(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/blocked-tokens`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ address }),
        }
      );
      setBlockedTokensInput("");
      fetchBlockedTokens();
    } catch { }
    setBlockedTokensLoading(false);
  };
  const handleRemoveBlockedToken = async (address: string) => {
    setBlockedTokensLoading(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/blocked-tokens`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ address }),
        }
      );
      fetchBlockedTokens();
    } catch { }
    setBlockedTokensLoading(false);
  };

  /* =========================================================
     EFFECTS  (identical to original)
  ========================================================= */
  useEffect(() => {
    if (!open) return;
    const fetchBuyFilters = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/buy-filters`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (data.buyFilters)
          onChangeBuyFilters({ ...buyFilters, ...data.buyFilters });
      } catch { }
    };
    fetchBuyFilters();
    fetchWhitelistDevs();
    fetchBlacklistDevs();
    fetchBlockedTokens();
    const fetchSellFilters = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/sell-filters`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (data.sellFilters)
          onChangeSellFilters({ ...sellFilters, ...data.sellFilters });
      } catch { }
    };
    fetchSellFilters();
  }, [open]);

  useEffect(() => {
    if (!whitelistDevsDropdownOpen) return;
    const handler = (e: MouseEvent) =>
      dropdownRef.current &&
      !dropdownRef.current.contains(e.target as Node) &&
      setWhitelistDevsDropdownOpen(false);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [whitelistDevsDropdownOpen]);

  useEffect(() => {
    if (!blacklistDevsDropdownOpen) return;
    const handler = (e: MouseEvent) =>
      blacklistDropdownRef.current &&
      !blacklistDropdownRef.current.contains(e.target as Node) &&
      setBlacklistDevsDropdownOpen(false);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [blacklistDevsDropdownOpen]);

  useEffect(() => {
    if (!blockedTokensDropdownOpen) return;
    const handler = (e: MouseEvent) =>
      blockedTokensDropdownRef.current &&
      !blockedTokensDropdownRef.current.contains(e.target as Node) &&
      setBlockedTokensDropdownOpen(false);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [blockedTokensDropdownOpen]);

  /* =========================================================
     HANDLERS  (identical to original)
  ========================================================= */
  const handleBuyFilterChange = async (field: string, value: any) => {
    onChangeBuyFilters({ ...buyFilters, [field]: value });
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/buy-filter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ field, value }),
        }
      );
    } catch { }
  };
  const handleSellFilterChange = async (field: string, value: any) => {
    onChangeSellFilters({ ...sellFilters, [field]: value });
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/user-filters/sell-filter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ field, value }),
        }
      );
    } catch { }
  };

  if (!open) return null;

  /* =========================================================
     RENDER  (identical structure, classNames only)
  ========================================================= */
  return (
    <div className="bsfm-wrapper">
      <div className="bsfm-backdrop" onClick={onClose} />
      <div className="bsfm-modal">
        {/* Top bar: Filter (left), Close (right) */}
        <div className="bsfm-header">
          <h3>Filter</h3>
          <button className="bsfm-close" onClick={onClose}>
            ×
          </button>
        </div>
        {/* Divider */}
        {/* <div className="bsfm-partition-line"></div> */}
        {/* Buy/Sell tabs below */}
        <div className="bsfm-tabs">
          <div className="bsfm-tabs-center">
            <button
              className={`bsfm-tab${activeTab === "buy" ? " bsfm-tab--active" : ""
                }`}
              onClick={() => setActiveTab("buy")}
            >
              🛒 Buy Filters
            </button>
            <button
              className={`bsfm-tab${activeTab === "sell" ? " bsfm-tab--active" : ""
                }`}
              onClick={() => setActiveTab("sell")}
            >
              💸 Sell Filters
            </button>
          </div>
        </div>
        {/* BUY TAB */}
        {activeTab === "buy" && (
          <div className="bsfm-body">
            {/* --- Anti-Rug --- */}
            <div className="bsfm-section">


              <div className="bsfm-row bsfm-row--inline">
                <label style={{ minWidth: 0, marginRight: 6 }}>
                  Anti-Rug
                  <InfoIcon   tip="Enable to skip tokens with suspicious liquidity or developer activity. Helps avoid scams and rug pulls." className="antirug-tooltip"/>
                  <input
                    type="checkbox"
                    checked={!!buyFilters.antiRug}
                    onChange={(e) =>
                      handleBuyFilterChange("antiRug", e.target.checked)
                    }
                    style={{ marginLeft: 4, marginRight: 16 }}
                  />
                </label>
                <label style={{ minWidth: 0, marginRight: 6 }}>
                  No Bribe Mode
                  <InfoIcon tip="Enable to avoid sending bribes in buy transactions. Use if you want to avoid extra costs, but may miss early access." className="noBribeMode-tooltip"/>
                  <input
                    type="checkbox"
                    checked={!!buyFilters.noBribeMode}
                    onChange={(e) =>
                      handleBuyFilterChange("noBribeMode", e.target.checked)
                    }
                    style={{ marginLeft: 4 }}
                  />
                </label>
              </div>
            </div>
            <div className="bsfm-section">
              <div className="bsfm-row bsfm-row--lp">
                <label>
                  LP Lock Time (min):
                  <InfoIcon tip="Require LP locked for at least this many minutes." className="lpLockTime-tooltip" />
                </label>
                <input
                  type="number"
                  value={buyFilters.minLpLockTime || ""}
                  onChange={(e) =>
                    handleBuyFilterChange("minLpLockTime", e.target.value)
                  }
                />
              </div>
            </div>
            {/* ---------- Whitelist devs dropdown ---------- */}
            <div className="bsfm-section">
              <div className="bsfm-row bsfm-row--wl">
                <label>
                  Whitelist Devs:
                  <InfoIcon tip="Only buy tokens if the developer address is in this list." className="whitelistDevs-tooltip"/>
                </label>

                <div className="bsfm-dropdown bsfm-dropdown--wl" ref={dropdownRef}>
                  <div
                    className="bsfm-dropdown-toggle"
                    onClick={() => setWhitelistDevsDropdownOpen((v) => !v)}
                  >
                    {whitelistDevs.filter((d) => d !== "true").length === 0
                      ? "No dev Whitelisted"
                      : `Whitelist: ${whitelistDevs.filter((d) => d !== "true").length
                      } dev(s)`}
                    <span className="bsfm-arrow">▼</span>
                  </div>

                  {whitelistDevsDropdownOpen && (
                    <div className="bsfm-dropdown-menu">
                      {whitelistLoading && (
                        <div className="bsfm-loading">Loading…</div>
                      )}

                      {!whitelistLoading && (
                        <>
                          {whitelistDevs
                            .filter((d) => d !== "true")
                            .map((dev) => (
                              <div key={dev} className="bsfm-tag">
                                <span>{dev}</span>
                                <button onClick={() => handleRemoveDev(dev)}>
                                  ×
                                </button>
                              </div>
                            ))}

                          <input
                            style={{ fontSize: 10, padding: 10 }}
                            type="text"
                            placeholder="Add address & press Enter"
                            value={whitelistInput}
                            onChange={(e) => {
                              setWhitelistInput(e.target.value);
                              setWhitelistError("");
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleAddDev()}
                          />
                          {whitelistError && (
                            <div className="bsfm-error">{whitelistError}</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ---------- Blacklist devs dropdown ---------- */}
            <div className="bsfm-section">


              <div className="bsfm-row bsfm-row--wl">
                <label>
                  Blacklist Devs:
                  <InfoIcon tip="Never buy tokens if the developer address is in this list." className="blacklistDevs-tooltip"/>
                </label>

                <div
                  className="bsfm-dropdown bsfm-dropdown--danger bsfm-dropdown--wl"
                  ref={blacklistDropdownRef}
                >
                  <div
                    className="bsfm-dropdown-toggle"
                    onClick={() => setBlacklistDevsDropdownOpen((v) => !v)}
                  >
                    {blacklistDevs.length === 0
                      ? "No devs blacklisted"
                      : `Blacklist: ${blacklistDevs.length} dev(s)`}
                    <span className="bsfm-arrow">▼</span>
                  </div>

                  {blacklistDevsDropdownOpen && (
                    <div className="bsfm-dropdown-menu">
                      {blacklistLoading && (
                        <div className="bsfm-loading">Loading…</div>
                      )}

                      {!blacklistLoading && (
                        <>
                          {blacklistDevs.map((dev) => (
                            <div key={dev} className="bsfm-tag bsfm-tag--danger">
                              <span>{dev}</span>
                              <button
                                onClick={() => handleRemoveBlacklistDev(dev)}
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          <input
                            style={{ fontSize: 10, padding: 10 }}
                            type="text"
                            placeholder="Add address & press Enter"
                            value={blacklistInput}
                            onChange={(e) => {
                              setBlacklistInput(e.target.value);
                              setBlacklistError("");
                            }}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleAddBlacklistDev()
                            }
                          />
                          {blacklistError && (
                            <div className="bsfm-error">{blacklistError}</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ---------- buyUntilReached ---------- */}
            <div className="bsfm-section">
              <div className="bsfm-row bsfm-row--inline">
                <label>
                  Buy Until Reached
                  <InfoIcon tip="Enable to keep buying until one of the below conditions is met." className="buyUntilReached-tooltip"/>
                  <input
                    type="checkbox"
                    checked={!!buyFilters.buyUntilReached}
                    onChange={(e) => handleBuyFilterChange("buyUntilReached", e.target.checked)}
                    style={{ marginLeft: 4 }}
                  />
                </label>

                {buyFilters.buyUntilReached && (
                  <div className="bsfm-buy-until">
                    <div className="form-group">
                      <input
                        type="number"
                        id="marketCap"
                        placeholder=" "
                        value={buyFilters.buyUntilMarketCap || ""}
                        onChange={(e) => handleBuyFilterChange("buyUntilMarketCap", e.target.value)}
                        required
                      />
                      <label htmlFor="marketCap">Market Cap</label>
                    </div>

                    <div className="form-group">
                      <input
                        type="number"
                        id="Price"
                        placeholder=" "
                        value={buyFilters.buyUntilPrice || ""}
                        onChange={(e) => handleBuyFilterChange("buyUntilPrice", e.target.value)}
                        required
                      />
                      <label htmlFor="Price">Price</label>
                    </div>

                    <div className="form-group">
                      <input
                        type="number"
                        id="Amount"
                        placeholder=" "
                        value={buyFilters.buyUntilAmount || ""}
                        onChange={(e) => handleBuyFilterChange("buyUntilAmount", e.target.value)}
                        required
                      />
                      <label htmlFor="Amount">Amount</label>
                    </div>

                    {/* <label>

                      <input
                        type="number"
                        placeholder="Market Cap"
                        value={buyFilters.buyUntilMarketCap || ""}
                        onChange={(e) => handleBuyFilterChange("buyUntilMarketCap", e.target.value)}
                      />
                    </label> */}
                    {/* <label>
                      <input
                        type="number"
                        placeholder="Price"
                        value={buyFilters.buyUntilPrice || ""}
                        onChange={(e) => handleBuyFilterChange("buyUntilPrice", e.target.value)}
                      />
                    </label>
                    <label>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={buyFilters.buyUntilAmount || ""}
                        onChange={(e) => handleBuyFilterChange("buyUntilAmount", e.target.value)}
                      />
                    </label> */}
                  </div>
                )}
              </div>
            </div>



            <div className="bsfm-section">

              <div className="bsfm-row bsfm-row--lp">
                <label>
                  Buy Timeout (sec):
                  <InfoIcon tip="Cancel the buy transaction if it is not confirmed within this number of seconds." className="buyTimeout-tooltip"/>
                </label>
                <input
                  type="number"
                  value={buyFilters.timeout || ""}
                  onChange={(e) =>
                    handleBuyFilterChange("timeout", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* SELL TAB */}
        {activeTab === "sell" && (
          <div className="bsfm-body">

            <div className="bsfm-section">

            <div className="bsfm-row bsfm-row--lp">
              <label>
                Min Liquidity (SOL):
                <InfoIcon tip="Only sell if the token’s liquidity pool is above this value." className="minLiquidity-tooltip"/>
              </label>
              <input
                type="number"
                value={sellFilters.minLiquidity || ""}
                onChange={(e) =>
                  handleSellFilterChange("minLiquidity", e.target.value)
                }
              />
            </div>
            </div>
                
              <div className="bsfm-section">

            <div className="bsfm-row bsfm-row--inline">
              <label style={{minWidth: 0, marginRight: 6}}>
                Front-run Protection:
                <InfoIcon tip="Avoid selling if price manipulation or front-running is detected." className="frontRunProtection-tooltip"/>
              </label>
              <input
                type="checkbox"
                checked={!!sellFilters.frontRunProtection}
                onChange={(e) =>
                  handleSellFilterChange("frontRunProtection", e.target.checked)
                }
              />

              <label style={{minWidth: 0, marginRight: 6}}>
                Repeatable Strategy:
                <InfoIcon tip="Auto-repeat your sell strategy after each sell." className="repeatableStrategy-tooltip"/>
              </label>
              <input
                type="checkbox"
                checked={!!sellFilters.loopSellLogic}
                onChange={(e) =>
                  handleSellFilterChange("loopSellLogic", e.target.checked)
                }
                style={{marginLeft: 4}}
              />
            </div>
              </div>

            {/* ---------- Blocked tokens dropdown ---------- */}
            <div className="bsfm-section">

            
            <div className="bsfm-row bsfm-row--wl">
              <label>
                Blocked Tokens:
                <InfoIcon tip="Never sell these tokens, no matter what." className="blacklistDevs-tooltip"/>
              </label>

              <div
                className="bsfm-dropdown bsfm-dropdown--danger bsfm-dropdown--wl"
                ref={blockedTokensDropdownRef}
              >
                <div
                  className="bsfm-dropdown-toggle"
                  onClick={() => setBlockedTokensDropdownOpen((v) => !v)}
                >
                  {blockedTokens.length === 0
                    ? "No tokens blocked"
                    : `Blocked: ${blockedTokens.length} token(s)`}
                  <span className="bsfm-arrow">▼</span>
                </div>

                {blockedTokensDropdownOpen && (
                  <div className="bsfm-dropdown-menu">
                    {blockedTokensLoading && (
                      <div className="bsfm-loading">Loading…</div>
                    )}

                    {!blockedTokensLoading && (
                      <>
                        {blockedTokens.map((token) => (
                          <div
                            key={token}
                            className="bsfm-tag bsfm-tag--danger"
                          >
                            <span>{token}</span>
                            <button
                              onClick={() => handleRemoveBlockedToken(token)}
                            >
                              ×
                            </button>
                          </div>
                        ))}

                        <input
                        style={{ fontSize: 10, padding: 10 }}
                          type="text"
                          placeholder="Add address & press Enter"
                          value={blockedTokensInput}
                          onChange={(e) =>
                            setBlockedTokensInput(e.target.value)
                          }
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleAddBlockedToken()
                          }
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        )}

        {/* <div className="bsfm-partition-line"></div> */}
      </div>
    </div>
  );
};

export default BuySellFilterPanel;

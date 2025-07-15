import React, { useState } from "react";

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

  if (!open) return null;

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
                    <input type="number" value={buyFilters.maxMcap || ""} onChange={e => onChangeBuyFilters({ ...buyFilters, maxMcap: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Max Buyers:
                      <InfoIcon tip="Only buy tokens with fewer buyers than this value. Helps you get in early before the crowd." />
                    </span>
                    <input type="number" value={buyFilters.maxBuyers || ""} onChange={e => onChangeBuyFilters({ ...buyFilters, maxBuyers: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Max Token Age (sec):
                      <InfoIcon tip="Only buy tokens created within this number of seconds. Useful for sniping new launches." />
                    </span>
                    <input type="number" value={buyFilters.maxTokenAge || ""} onChange={e => onChangeBuyFilters({ ...buyFilters, maxTokenAge: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ minWidth: 180, color: "#fff" }}>
                        Anti-Rug:
                        <InfoIcon tip="Enable to skip tokens with suspicious liquidity or developer activity. Helps avoid scams and rug pulls." />
                      </span>
                      <input type="checkbox" checked={!!buyFilters.antiRug} onChange={e => onChangeBuyFilters({ ...buyFilters, antiRug: e.target.checked })} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ minWidth: 180, color: "#fff" }}>
                        No Bribe Mode:
                        <InfoIcon tip="Enable to avoid sending bribes in buy transactions. Use if you want to avoid extra costs, but may miss early access." />
                      </span>
                      <input type="checkbox" checked={!!buyFilters.noBribeMode} onChange={e => onChangeBuyFilters({ ...buyFilters, noBribeMode: e.target.checked })} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      LP Lock Time (min):
                      <InfoIcon tip="Only buy tokens whose liquidity pool is locked for at least this many minutes. Reduces risk of rug pulls." />
                    </span>
                    <input type="number" value={buyFilters.minLpLockTime || ""} onChange={e => onChangeBuyFilters({ ...buyFilters, minLpLockTime: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Whitelist Devs:
                      <InfoIcon tip="Only buy tokens if the developer address is in this list. Use to support trusted devs." />
                    </span>
                    <input type="text" value={buyFilters.whitelistDevs || ""} onChange={e => onChangeBuyFilters({ ...buyFilters, whitelistDevs: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Blacklist Devs:
                      <InfoIcon tip="Never buy tokens if the developer address is in this list. Helps avoid known scam devs." />
                    </span>
                    <input type="text" value={buyFilters.blacklistDevs || ""} onChange={e => onChangeBuyFilters({ ...buyFilters, blacklistDevs: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Buy Until Reached:
                      <InfoIcon tip="Keep buying until a take profit or stop loss condition is met. Useful for automated strategies." />
                    </span>
                    <input type="text" value={buyFilters.autoSellCondition || ""} onChange={e => onChangeBuyFilters({ ...buyFilters, autoSellCondition: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ minWidth: 180, color: "#fff" }}>
                      Buy Timeout (sec):
                      <InfoIcon tip="Cancel the buy transaction if it is not confirmed within this number of seconds. Prevents stuck or slow buys." />
                    </span>
                    <input type="number" value={buyFilters.timeout || ""} onChange={e => onChangeBuyFilters({ ...buyFilters, timeout: e.target.value })} style={inputStyle} />
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

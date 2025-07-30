import React, { useEffect, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWallet,
  faCheckCircle,
  faBook,
} from "@fortawesome/free-solid-svg-icons";
import { faDiscord, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import "../assets/FooterBar.css";
import { faGears } from '@fortawesome/free-solid-svg-icons'; 

interface FooterBarProps {
  onOpenSettings: () => void;
}

const LATENCY_LIMIT = 300; // ms

const FooterBar: React.FC<FooterBarProps> = ({ onOpenSettings }) => {
  const [solPrice, setSolPrice] = useState<number>(0);

  // --- WebSocket connection & latency state ---
  const [wsConnected, setWsConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // WebSocket connect
    const ws = new WebSocket(import.meta.env.VITE_WS_BASE_URL || "ws://localhost:4000");
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "PONG" && typeof data.pingSent === "number") {
          setLatency(Date.now() - data.pingSent);
        }
      } catch {}
    };

    // Ping every 5 seconds
    const interval = setInterval(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "PING", pingSent: Date.now() }));
      }
    }, 5000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchSolPrice = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sol-price`);
        const data = await response.json();
        setSolPrice(data.price || 0);
      } catch (error) {
        setSolPrice(0);
      }
    };
    fetchSolPrice();
    interval = setInterval(fetchSolPrice, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- Status logic ---
  let statusText = "Disconnected";
  let statusColor = "#f44336"; // red
  if (wsConnected) {
    if (latency !== null && latency > LATENCY_LIMIT) {
      statusText = "Unstable";
      statusColor = "#ff9800"; // orange
    } else {
      statusText = "Stable";
      statusColor = "#4caf50"; // green
    }
  }

  return (
    <footer className="footer-bar">
      <div className="footer-left">
        <button className="footer-btn preset-button" onClick={onOpenSettings}>
          <FontAwesomeIcon
            icon={faGears}
            style={{ fontSize: "12px", marginRight: 6 }}
          />
          Presets
        </button>
        <div className="footer-divider" />
        <button className="footer-btn">
          <FontAwesomeIcon icon={faWallet} style={{ fontSize: "12px" }} />{" "}
          Wallets
        </button>
        
        {/* Mobile-only SOL price - Hidden on desktop */}
        <div className="mobile-sol-price">
          <span className="footer-balance">
            <img
              src="/footerIcon/solana.png"
              alt="SOL"
              style={{ height: 12, width: 12, marginRight: 1 }}
            />
            <span className="solanaPrice">$</span>
            <span className="solanaPrice">
              {solPrice === 0 ? (
                <span className="wallet-value-skeleton"></span>
              ) : (
                solPrice.toLocaleString("en-US", { maximumFractionDigits: 3 })
              )}
            </span>
          </span>
        </div>
      </div>

      <div className="footer-center">
        <span className="footer-balance" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <img
            src="/footerIcon/solana.png"
            alt="SOL"
            style={{ height: 12, width: 12, marginRight: 1 }}
          />
          <span className="solanaPrice">$</span>
          <span className="solanaPrice">
            {solPrice === 0 ? (
              <span className="wallet-value-skeleton"></span>
            ) : (
              solPrice.toLocaleString("en-US", { maximumFractionDigits: 3 })
            )}
          </span>
        </span>
        <div className="footer-divider" />
        <span className="footer-status">
          <FontAwesomeIcon
            icon={faCheckCircle}
            style={{ color: statusColor, fontSize: "12px", marginRight: 4 }}
          />
          Connection is {statusText}
          {wsConnected && latency !== null && (
            <span style={{ marginLeft: 8, fontWeight: 500, fontSize: 13, color: "#aaa" }}>
              {latency} ms
            </span>
          )}
        </span>
      </div>

      <div className="footer-right">
        <a
          className="footer-icon-btn"
          href="https://discord.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FontAwesomeIcon icon={faDiscord} style={{ fontSize: "12px" }} />
        </a>
        <a
          className="footer-icon-btn"
          href="https://x.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FontAwesomeIcon icon={faXTwitter} style={{ fontSize: "12px" }} />
        </a>
        <a
          className="footer-btn"
          href="https://docs.example.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FontAwesomeIcon
            icon={faBook}
            style={{ fontSize: "12px", marginRight: 4 }}
          />{" "}
          Docs
        </a>
      </div>
    </footer>
  );
};

export default FooterBar;
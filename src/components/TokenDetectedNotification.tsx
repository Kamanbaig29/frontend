import { useContext } from 'react';
import { WebSocketContext } from '../context/webSocketContext';

const TokenDetectedNotification = () => {
  const {
    latestDetectedTokenName,
    latestDetectedTokenCreator,
    latestDetectedTokenImage,
    latestDetectedTokenMint,
  } = useContext(WebSocketContext);

  const creatorShort = latestDetectedTokenCreator ? latestDetectedTokenCreator.substring(0, 4) : '----';
  const tokenName = latestDetectedTokenName || 'Waiting...';

  return (
    <div
      key={latestDetectedTokenMint}
      className="token-notification"
      style={{
        position: "fixed",
        top: "58px",
        left: "20%",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "clamp(4px, 1vw, 8px)",
        padding: "clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)",
        borderRadius: "8px",
        background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
        color: "#00ff88",
        fontSize: "clamp(8px, 2vw, 10px)",
        fontWeight: 600,
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        border: "1px solid rgba(0,255,136,0.3)",
        animation: latestDetectedTokenMint ? "wobbleIn 0.6s ease-out" : "none",
        maxWidth: "min(80vw, 300px)",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <img src="/noti/coin-toss.png" alt="" style={{ width: "clamp(12px, 3vw, 15px)", height: "clamp(12px, 3vw, 15px)", flexShrink: 0 }} />
      <span style={{ minWidth: 0, textOverflow: "ellipsis", overflow: "hidden" }}>{creatorShort}</span>
      <span style={{ minWidth: 0, textOverflow: "ellipsis", overflow: "hidden" }}>Create</span>
      <span style={{ minWidth: 0, textOverflow: "ellipsis", overflow: "hidden", maxWidth: "60px" }}>{tokenName}</span>
      <img src={latestDetectedTokenImage || "/tokenDetail/group.png"} alt="" style={{ width: "clamp(12px, 3vw, 15px)", height: "clamp(12px, 3vw, 15px)", flexShrink: 0 }} />
    </div>
  );
};

// Add wobble animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes wobbleIn {
    0% {
      opacity: 0;
      transform: scale(0.3) rotate(-10deg);
    }
    50% {
      transform: scale(1.05) rotate(2deg);
    }
    70% {
      transform: scale(0.9) rotate(-1deg);
    }
    100% {
      opacity: 1;
      transform: scale(1) rotate(0deg);
    }
  }
  @media (max-width: 768px) {
    .token-notification {
      top: 65px !important;
      left: 25% !important;
      font-size: 8px !important;
      padding: 4px 8px !important;
      gap: 4px !important;
      max-width: 85vw !important;
    }
  }
  @media (max-width: 480px) {
    .token-notification {
      top: 65px !important;
      left: 30% !important;
      font-size: 7px !important;
      padding: 3px 6px !important;
      gap: 3px !important;
      max-width: 90vw !important;
    }
  }
`;
document.head.appendChild(style);

export default TokenDetectedNotification;

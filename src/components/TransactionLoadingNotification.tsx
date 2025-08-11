import { useContext } from "react";
import { WebSocketContext } from "../context/webSocketContext";

const TransactionLoadingNotification = () => {
  const { transactionLoading } = useContext(WebSocketContext);

  if (!transactionLoading.type) return null;

  const getNotificationStyle = () => {
    if (transactionLoading.message.includes('sending')) {
      return {
        background: "rgba(0, 0, 0, 0.8)",
        color: "white",
      };
    }
    if (transactionLoading.message.includes('success') || transactionLoading.message.includes('✅')) {
      return {
        background: "rgba(0, 212, 170, 0.1)",
        color: "#00d4aa",
        border: "1px solid rgba(0, 212, 170, 0.3)",
      };
    }
    if (transactionLoading.message.includes('failed') || transactionLoading.message.includes('❌')) {
      return {
        background: "rgba(255, 0, 0, 0.185)",
        color: "rgb(255, 159, 159)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      };
    }
    return {
      background: "rgba(0, 0, 0, 0.8)",
      color: "white",
    };
  };

  return (
    <div
      className="transaction-notification"
      style={{
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        backdropFilter: "blur(10px)",
        padding: "clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px)",
        borderRadius: "8px",
        fontSize: "clamp(12px, 2.5vw, 14px)",
        fontWeight: 500,
        zIndex: 10000,
        animation: "fadeInOut 3s ease-in-out",
        maxWidth: "min(90vw, 400px)",
        minWidth: "200px",
        textAlign: "center",
        wordBreak: "break-word",
        ...getNotificationStyle(),
      }}
    >
      {transactionLoading.message.includes('sending') && (
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(6px, 1.5vw, 8px)", justifyContent: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: "clamp(10px, 2.5vw, 12px)",
              height: "clamp(10px, 2.5vw, 12px)",
              border: "2px solid white",
              borderTop: "2px solid transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              flexShrink: 0,
            }}
          />
          <span style={{ minWidth: 0 }}>{transactionLoading.message}</span>
        </div>
      )}
      {!transactionLoading.message.includes('sending') && (
        <span>{transactionLoading.message}</span>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes fadeInOut {
            0% {
              opacity: 0;
              transform: translateX(-50%) scale(0.9);
            }
            20%, 80% {
              opacity: 1;
              transform: translateX(-50%) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateX(-50%) scale(0.9);
            }
          }
          @media (max-width: 768px) {
            .transaction-notification {
              top: 10px !important;
              padding: 8px 16px !important;
              font-size: 12px !important;
              max-width: 85vw !important;
              min-width: 150px !important;
            }
          }
          @media (max-width: 480px) {
            .transaction-notification {
              top: 8px !important;
              padding: 6px 12px !important;
              font-size: 11px !important;
              max-width: 90vw !important;
              min-width: 120px !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default TransactionLoadingNotification;
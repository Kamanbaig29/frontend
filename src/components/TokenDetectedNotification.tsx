import { useContext, useEffect } from "react";
import { WebSocketContext } from "../context/webSocketContext";

const TokenDetectedNotification = () => {
  const {
    showTokenDetectedNotification,
    setShowTokenDetectedNotification,
  } = useContext(WebSocketContext);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (showTokenDetectedNotification) {
      timer = setTimeout(() => {
        setShowTokenDetectedNotification(false);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [showTokenDetectedNotification, setShowTokenDetectedNotification]);

  if (!showTokenDetectedNotification) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "4.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        minWidth: 340,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          borderRadius: "0.75rem",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          border: "2px solid #FFD600",
          background: "#FFF9C4",
          color: "#7C6500",
          fontWeight: 600,
          fontSize: "1.15rem",
          minWidth: 340,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>🚀</span>
          <span>New Token Detected!</span>
        </div>
        <button
          onClick={() => setShowTokenDetectedNotification(false)}
          style={{
            marginLeft: 16,
            color: "#7C6500",
            background: "none",
            border: "none",
            fontSize: 24,
            fontWeight: "bold",
            cursor: "pointer",
            outline: "none",
          }}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default TokenDetectedNotification;

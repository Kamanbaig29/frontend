import React, { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';

// Define the shape of the context state
export interface WebSocketContextType {
  ws: WebSocket | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendMessage: (data: any) => void;
  isAuthenticated: boolean;
  authenticate: (token: string) => void;
  walletAddress?: string; // <-- add this
  // amazonq-ignore-next-line
  buyPresets: any[];
  sellPresets: any[];
  activeBuyPreset: number;
  activeSellPreset: number;
  setActiveBuyPreset: (idx: number) => void;
  setActiveSellPreset: (idx: number) => void;
  showTokenDetectedNotification: boolean;
  setShowTokenDetectedNotification: (show: boolean) => void;
  latestDetectedTokenMint: string | null;
  setLatestDetectedTokenMint: (mint: string | null) => void;
  latestDetectedTokenName: string | null;
  setLatestDetectedTokenName: (name: string | null) => void;
  latestDetectedTokenCreator: string | null;
  setLatestDetectedTokenCreator: (creator: string | null) => void;
  latestDetectedTokenImage: string | null;
  setLatestDetectedTokenImage: (imageUrl: string | null) => void;
  transactionLoading: { type: 'buy' | 'sell' | null; message: string };
  setTransactionLoading: (loading: { type: 'buy' | 'sell' | null; message: string }) => void;
}

// Create the context with a default value
const WebSocketContext = createContext<WebSocketContextType>({
  ws: null,
  status: 'disconnected',
  sendMessage: () => console.error('sendMessage function not ready'),
  isAuthenticated: false,
  authenticate: () => {},
  buyPresets: [],
  sellPresets: [],
  activeBuyPreset: 0,
  activeSellPreset: 0,
  setActiveBuyPreset: () => {},
  setActiveSellPreset: () => {},
  showTokenDetectedNotification: false,
  setShowTokenDetectedNotification: () => {},
  latestDetectedTokenMint: null,
  setLatestDetectedTokenMint: () => {},
  latestDetectedTokenName: null,
  setLatestDetectedTokenName: () => {},
  latestDetectedTokenCreator: null,
  setLatestDetectedTokenCreator: () => {},
  latestDetectedTokenImage: null,
  setLatestDetectedTokenImage: () => {},
  transactionLoading: { type: null, message: '' },
  setTransactionLoading: () => {},
});

// Custom hook to use the WebSocket context
export const useWebSocket = () => {
  return useContext(WebSocketContext);
};

// Define the props for the provider
interface WebSocketProviderProps {
  children: ReactNode;
}

// Create the provider component
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [walletAddress, setWalletAddress] = useState<string | undefined>(undefined);
  const [buyPresets, setBuyPresets] = useState<any[]>([]);
  const [sellPresets, setSellPresets] = useState<any[]>([]);
  const [activeBuyPreset, setActiveBuyPreset] = useState<number>(0);
  const [activeSellPreset, setActiveSellPreset] = useState<number>(0);
  const [showTokenDetectedNotification, setShowTokenDetectedNotification] = useState(false);
  const [latestDetectedTokenMint, setLatestDetectedTokenMint] = useState<string | null>(null);
  const [latestDetectedTokenName, setLatestDetectedTokenName] = useState<string | null>(null);
  const [latestDetectedTokenCreator, setLatestDetectedTokenCreator] = useState<string | null>(null);
  const [latestDetectedTokenImage, setLatestDetectedTokenImage] = useState<string | null>(null);
  const [transactionLoading, setTransactionLoading] = useState<{ type: 'buy' | 'sell' | null; message: string }>({ type: null, message: '' });

  // Helper to send messages
  const sendMessage = (data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket Context] WebSocket is not open. Message not sent:', data);
    }
  };

  // Call this after login to update token and trigger reconnect
  const authenticate = (newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  };

  // Call this after logout to clear token and trigger disconnect
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setIsAuthenticated(false);
  };

  // Reconnect WebSocket whenever token changes
  useEffect(() => {
    if (!token) {
      // If no token, close any open socket and reset state
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsAuthenticated(false);
      setStatus('disconnected');
      return;
    }

    // Clean up any previous socket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setStatus('connecting');
    const socket = new WebSocket(import.meta.env.VITE_WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('connected');
      sendMessage({ type: "AUTHENTICATE", token });
    };

    // amazonq-ignore-next-line
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WS MESSAGE:", data);

      if (data.type === "TOKEN_DETECTED" && data.mint) {
        setShowTokenDetectedNotification(true);
        setLatestDetectedTokenMint(data.mint);
        setLatestDetectedTokenName(data.name || 'Unknown Token');
        setLatestDetectedTokenCreator(data.creator || 'Unknown');
        setLatestDetectedTokenImage(data.imageUrl || null);
      }

      if (data.type === 'AUTH_SUCCESS') {
        setIsAuthenticated(true);
        if (data.walletAddress) setWalletAddress(data.walletAddress); // <-- set here
      }

      if (
        data.type === "AUTH_ERROR" ||
        (data.type === "ERROR" && data.error && data.error.toLowerCase().includes("token"))
      ) {
        logout();
        window.location.href = "/"; // or your login route
      }

      if (data.type === "PRESETS") {
        //console.log("Received PRESETS from backend:", data);
        setBuyPresets(data.buyPresets || []);
        setSellPresets(data.sellPresets || []);
        setActiveBuyPreset(data.activeBuyPreset || 0);
        setActiveSellPreset(data.activeSellPreset || 0);
      }

      if (data.type === "NEW_TOKEN" && data.eventType === "launch") {
        // setShowTokenDetectedNotification(true); // This line is now handled by the new handler
        // setLatestDetectedTokenMint(data.token.mint); // This line is now handled by the new handler
      }
    };

    socket.onclose = () => {
      setStatus('disconnected');
      socketRef.current = null;
      setIsAuthenticated(false);
    };

    // amazonq-ignore-next-line
    socket.onerror = (_) => {
      setStatus('error');
      socket.close();
    };

    // Cleanup on unmount or token change
    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [token]);

  // Expose context
  return (
    <WebSocketContext.Provider value={{
      ws: socketRef.current,
      status,
      sendMessage,
      isAuthenticated,
      authenticate,
      walletAddress, // <-- add this
      buyPresets,
      sellPresets,
      activeBuyPreset,
      activeSellPreset,
      setActiveBuyPreset,
      setActiveSellPreset,
      showTokenDetectedNotification,
      setShowTokenDetectedNotification,
      latestDetectedTokenMint,
      setLatestDetectedTokenMint,
      latestDetectedTokenName,
      setLatestDetectedTokenName,
      latestDetectedTokenCreator,
      setLatestDetectedTokenCreator,
      latestDetectedTokenImage,
      setLatestDetectedTokenImage,
      transactionLoading,
      setTransactionLoading,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export { WebSocketContext };

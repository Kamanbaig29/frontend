import React, { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';

// Define the shape of the context state
export interface WebSocketContextType {
  ws: WebSocket | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendMessage: (data: any) => void;
  isAuthenticated: boolean;
  authenticate: (token: string) => void;
}

// Create the context with a default value
const WebSocketContext = createContext<WebSocketContextType>({
  ws: null,
  status: 'disconnected',
  sendMessage: () => console.error('sendMessage function not ready'),
  isAuthenticated: false,
  authenticate: () => {},
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
    const socket = new WebSocket('ws://localhost:4000');
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('connected');
      sendMessage({ type: "AUTHENTICATE", token });
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'AUTH_SUCCESS') {
        setIsAuthenticated(true);
      }

      if (
        data.type === "AUTH_ERROR" ||
        (data.type === "ERROR" && data.error && data.error.toLowerCase().includes("token"))
      ) {
        logout();
        window.location.href = "/"; // or your login route
      }
    };

    socket.onclose = () => {
      setStatus('disconnected');
      socketRef.current = null;
      setIsAuthenticated(false);
    };

    socket.onerror = (error) => {
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
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

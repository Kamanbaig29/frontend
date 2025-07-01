import React, { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';

// Define the shape of the context state
export interface WebSocketContextType {
  ws: WebSocket | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'error'; // <-- yeh line add karo
  sendMessage: (data: any) => void;
  isAuthenticated: boolean; // <-- yeh line add karo
  authenticate: (token: string) => void;
  // ...baaki properties...
}

// Create the context with a default value
const WebSocketContext = createContext<WebSocketContextType>({
  ws: null,
  status: 'disconnected',
  sendMessage: () => console.error('sendMessage function not ready'),
  isAuthenticated: false, // <-- add default value
  authenticate: () => {}, // <-- add default value
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
  const [isAuthenticated, setIsAuthenticated] = useState(false); // <-- add state
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendMessage = (data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket Context] WebSocket is not open. Message not sent:', data);
    }
  };

  const authenticate = (token: string) => {
    sendMessage({ type: 'AUTHENTICATE', token });
    setIsAuthenticated(true); // <-- update state on authenticate
  };

  useEffect(() => {
    // This function encapsulates the connection logic.
    const connect = () => {
      // Prevent multiple connection attempts
      if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        return;
      }
      
      console.log("[WebSocket Context] Attempting to connect...");
      const socket = new WebSocket('ws://localhost:4000');
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('[WebSocket Context] Connection established');
        setStatus('connected');
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        const token = localStorage.getItem("token");
        if (token) {
          sendMessage({ type: "AUTHENTICATE", token });
        }
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket: Received message:', data);

        if (data.type === 'AUTH_SUCCESS') {
          console.log('[WebSocket Context] Authentication successful!');
          setIsAuthenticated(true); // <-- update state on auth success
          // Handle successful authentication
        }
      };

      socket.onclose = () => {
        console.log('[WebSocket Context] Connection closed');
        setStatus('disconnected');
        socketRef.current = null; // Clear the ref
        
        // Schedule reconnection
        if (!reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
                console.log("[WebSocket Context] Reconnecting...");
                connect();
            }, 3000); // Reconnect after 3 seconds
        }
      };

      socket.onerror = (error) => {
        console.error('[WebSocket Context] Error:', error);
        setStatus('error');
        socket.close(); // This will trigger the onclose handler, which handles reconnect logic.
      };
    };

    connect();

    // The cleanup function is crucial for preventing memory leaks.
    return () => {
      console.log("[WebSocket Context] Cleanup function running.");
      // Clear the reconnect timer if it's set.
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // We only close the socket on unmount.
      // The logic inside `connect` prevents re-creating it if it's not needed.
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent the automatic reconnect from firing on purposefule close.
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []); // The empty dependency array is correct.

  // We expose the raw socket object via the ref's current value.
  const value = { ws: socketRef.current, status, sendMessage, isAuthenticated, authenticate };

  return (
    <WebSocketContext.Provider value={{
      ws: socketRef.current,
      status,           // <-- add this
      sendMessage,      // <-- add this
      isAuthenticated,
      authenticate,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

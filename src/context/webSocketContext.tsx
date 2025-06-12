import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface WebSocketContextType {
  ws: WebSocket | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error: string | null;
  sendMessage: (message: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  
  const isConnecting = React.useRef(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimeout: NodeJS.Timeout;

    const connect = () => {
      if (isConnecting.current) return;
      
      if (retryCount >= maxRetries) {
        setStatus('error');
        setError('Max retry attempts reached. Please check if the server is running.');
        return;
      }

      try {
        isConnecting.current = true;
        socket = new WebSocket('ws://localhost:3001');
        
        socket.onopen = () => {
          console.log('WebSocket: Connected to backend');
          setStatus('connected');
          setError(null);
          setRetryCount(0);
          isConnecting.current = false;
        };

        socket.onclose = (event) => {
          console.log('WebSocket: Connection closed', event.code, event.reason);
          setStatus('disconnected');
          isConnecting.current = false;
          
          if (retryCount < maxRetries) {
            retryTimeout = setTimeout(() => {
              setRetryCount(prev => prev + 1);
              connect();
            }, 3000);
          } else {
            setStatus('error');
            setError('Failed to connect to WebSocket server after multiple attempts');
          }
        };

        socket.onerror = (event) => {
          console.error('WebSocket: Error', event);
          setStatus('error');
          setError('WebSocket connection error');
          isConnecting.current = false;
        };

        setWs(socket);
      } catch (err) {
        console.error('WebSocket: Connection error', err);
        setStatus('error');
        setError('Failed to create WebSocket connection');
        isConnecting.current = false;
      }
    };

    if (!ws || ws.readyState === WebSocket.CLOSED) {
      connect();
    }

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [retryCount, ws?.readyState]);

  const sendMessage = (message: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
      setError('Cannot send message: WebSocket is not connected');
    }
  };

  return (
    <WebSocketContext.Provider value={{ ws, status, error, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface BotState {
  isRunning: boolean;
  logs: Array<{
    type: 'info' | 'success' | 'error';
    message: string;
    timestamp: number;
  }>;
  tokens: Array<{
    mint: string;
    creator: string;
    bondingCurve: string;
    curveTokenAccount: string;
    userTokenAccount: string;
    metadata: string;
    decimals: number;
    supply?: string;
    status: 'detected' | 'buying' | 'bought' | 'failed';
    timestamp: number;
  }>;
}

const BotContext = createContext<{
  state: BotState;
} | null>(null);

export const BotProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<BotState>({
    isRunning: false,
    logs: [],
    tokens: []
  });

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'NEW_TOKEN':
          setState(prev => ({
            ...prev,
            tokens: [...prev.tokens, {
              ...data.tokenData,
              status: 'detected',
              timestamp: Date.now()
            }],
            logs: [...prev.logs, {
              type: 'info',
              message: `🎯 New token detected: ${data.tokenData.mint}`,
              timestamp: Date.now()
            }]
          }));
          break;

        case 'BUY_ATTEMPT':
          setState(prev => ({
            ...prev,
            tokens: prev.tokens.map(token => 
              token.mint === data.mintAddress 
                ? { ...token, status: 'buying' }
                : token
            ),
            logs: [...prev.logs, {
              type: 'info',
              message: `🔄 Attempting to buy: ${data.mintAddress}`,
              timestamp: Date.now()
            }]
          }));
          break;

        case 'BUY_SUCCESS':
          setState(prev => ({
            ...prev,
            tokens: prev.tokens.map(token => 
              // Check if we have the mint address from tokenData or mintAddress
              token.mint === (data.tokenData?.mint || data.mintAddress)
                ? { ...token, status: 'bought' }
                : token
            ),
            logs: [...prev.logs, {
              type: 'success',
              message: `✅ Successfully bought: ${data.tokenData?.mint || data.mintAddress || 'Unknown Token'}`,
              timestamp: Date.now()
            }]
          }));
          break;

        case 'TRANSACTION_LOG':
          setState(prev => ({
            ...prev,
            logs: [...prev.logs, {
              type: 'info',
              message: data.message,
              timestamp: Date.now()
            }]
          }));
          break;

        case 'ERROR':
          setState(prev => ({
            ...prev,
            logs: [...prev.logs, {
              type: 'error',
              message: `❌ ${data.message}`,
              timestamp: Date.now()
            }]
          }));
          break;
      }
    };

    ws.onopen = () => {
      setState(prev => ({
        ...prev,
        isRunning: true,
        logs: [...prev.logs, {
          type: 'info',
          message: '🟢 Connected to bot',
          timestamp: Date.now()
        }]
      }));
    };

    ws.onclose = () => {
      setState(prev => ({
        ...prev,
        isRunning: false,
        logs: [...prev.logs, {
          type: 'error',
          message: '🔴 Disconnected from bot',
          timestamp: Date.now()
        }]
      }));
    };

    return () => ws.close();
  }, []);

  return (
    <BotContext.Provider value={{ state }}>
      {children}
    </BotContext.Provider>
  );
};

export const useBot = () => {
  const context = useContext(BotContext);
  if (!context) throw new Error('useBot must be used within BotProvider');
  return context;
};
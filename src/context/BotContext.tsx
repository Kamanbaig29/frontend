import React, { createContext, useReducer, useContext } from 'react';
import type { ReactNode } from 'react';

interface TokenStats {
  mint: string;
  buyPrice: number;
  currentPrice: number;
  profitLoss: number;
  profitPercentage: number;
  holdingTime: string;
  status: 'holding' | 'selling' | 'sold';
}

interface Token {
  mint: string;
  status: 'bought' | 'buying' | 'failed';
  timestamp: number;
  creator: string;
  supply?: string;
  bondingCurve: string;
  curveTokenAccount: string;
  userTokenAccount: string;
  metadata: string;
  decimals: number;
  stats?: TokenStats;
}

interface State {
  tokens: Token[];
  logs: { type: string; message: string; timestamp: number }[];
  isRunning: boolean;
}

type Action =
  | { type: 'ADD_TOKEN'; payload: Token }
  | { type: 'UPDATE_TOKEN_STATS'; payload: { mint: string; stats: TokenStats } }
  | { type: 'ADD_LOG'; payload: { type: string; message: string } }
  | { type: 'SET_BOT_STATUS'; payload: boolean };

const initialState: State = {
  tokens: [],
  logs: [],
  isRunning: false,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOKEN':
      return { ...state, tokens: [...state.tokens, action.payload] };
    case 'UPDATE_TOKEN_STATS':
      return {
        ...state,
        tokens: state.tokens.map((token) =>
          token.mint === action.payload.mint
            ? { ...token, stats: action.payload.stats }
            : token
        ),
      };
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs, { ...action.payload, timestamp: Date.now() }] };
    case 'SET_BOT_STATUS':
      return { ...state, isRunning: action.payload };
    default:
      return state;
  }
};

const BotContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | undefined>(
  undefined
);

export const BotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <BotContext.Provider value={{ state, dispatch }}>{children}</BotContext.Provider>;
};

export const useBot = () => {
  const context = useContext(BotContext);
  if (!context) {
    throw new Error('useBot must be used within a BotProvider');
  }
  return context;
};
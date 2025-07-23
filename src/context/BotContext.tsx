import React, { createContext, useReducer, useContext } from "react";
import type { ReactNode } from "react";

interface TokenStats {
  mint: string;
  buyPrice: number;
  currentPrice: number;
  profitLoss: number;
  profitPercentage: number;
  holdingTime: string;
  status: "holding" | "selling" | "sold";
}

export interface Token {
  mint: string;
  status?: "bought" | "buying" | "failed" | "detected";
  transactionSignature?: string;
  executionTimeMs?: number;
  timestamp?: number; // <-- Add this line
  buyTime?: number; // <-- Add this line
  buyPrice?: number;
  tokenAmount?: number;
  creator?: string;
  bondingCurve?: string;
  curveTokenAccount?: string;
  metadata?: string;
  decimals?: number;
  supply?: number;
  stats?: TokenStats;
}

interface State {
  tokens: Token[];
  logs: { type: string; message: string; timestamp: number }[];
  isRunning: boolean;
}

export type Action =
  | { type: "ADD_TOKEN"; payload: Token }
  | { type: "UPDATE_TOKEN"; payload: Token }
  | { type: "RESET" }; // <-- Add this

const initialState: State = {
  tokens: [],
  logs: [],
  isRunning: false,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOKEN":
      if (!state.tokens.some(token => token.mint === action.payload.mint)) {
        return {
          ...state,
          tokens: [...state.tokens, action.payload],
        };
      }
      return state;
    case "UPDATE_TOKEN":
      return {
        ...state,
        tokens: state.tokens.map(token => 
          token.mint === action.payload.mint
            ? { ...token, ...action.payload }
            : token
        )
      };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
};

const BotContext = createContext<
  { state: State; dispatch: React.Dispatch<Action> } | undefined
>(undefined);

export const BotProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <BotContext.Provider value={{ state, dispatch }}>
      {children}
    </BotContext.Provider>
  );
};

export const useBot = () => {
  const context = useContext(BotContext);
  if (!context) {
    throw new Error("useBot must be used within a BotProvider");
  }
  return context;
};

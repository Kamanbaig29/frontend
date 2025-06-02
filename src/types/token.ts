// First create a new types file
export interface TokenStats {
    buyPrice: number;
    currentPrice: number;
    profitLoss: number;
    profitPercentage: number;
    holdingTime: string;
    status: 'holding' | 'selling' | 'sold';
}
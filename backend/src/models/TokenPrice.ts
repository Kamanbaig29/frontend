import mongoose from 'mongoose';

interface ITokenPrice {
    mint: string;
    buyPrice: number;
    currentPrice: number;
    lastUpdated: Date;
}

const tokenPriceSchema = new mongoose.Schema<ITokenPrice>({
    mint: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    buyPrice: {
        type: Number,
        required: true,
        default: 0
    },
    currentPrice: {
        type: Number,
        required: true,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

export const TokenPrice = mongoose.model<ITokenPrice>('TokenPrice', tokenPriceSchema);

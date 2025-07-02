import mongoose, { Schema, Document } from "mongoose";

export interface IPreset {
  buyAmount: string;
  slippage: number;
  priorityFee: string;
  bribeAmount: string;
  mevMode: "off" | "reduced" | "secure";
  rpcUrl: string;
  autoFee: boolean;
  maxFee: string;
}

export interface IUserPreset extends Document {
  userId: string;
  buyPresets: IPreset[];
  sellPresets: IPreset[];
  activeBuyPreset: number;
  activeSellPreset: number;
}

const PresetSchema: Schema = new Schema({
  buyAmount: { type: String, required: true, default: "0.001" },
  slippage: { type: Number, required: true, default: 1 },
  priorityFee: { type: String, required: true, default: "0.001" },
  bribeAmount: { type: String, required: true, default: "0.001" },
  mevMode: { type: String, enum: ["off", "reduced", "secure"], default: "off" },
  rpcUrl: { type: String, default: "" },
  autoFee: { type: Boolean, required: true, default: false },
  maxFee: { type: String, required: true, default: "0.001" },
});

const UserPresetSchema: Schema = new Schema({
  userId: { type: String, required: true, unique: true },
  buyPresets: {
    type: [PresetSchema],
    validate: {
      validator: (arr: any[]) => arr.length === 3,
      message: "User must have exactly 3 buy presets."
    },
    default: [{}, {}, {}]
  },
  sellPresets: {
    type: [PresetSchema],
    validate: {
      validator: (arr: any[]) => arr.length === 3,
      message: "User must have exactly 3 sell presets."
    },
    default: [{}, {}, {}]
  },
  activeBuyPreset: { type: Number, default: 0 },
  activeSellPreset: { type: Number, default: 0 },
});

export default mongoose.model<IUserPreset>("UserPreset", UserPresetSchema);

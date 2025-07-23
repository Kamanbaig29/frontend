import mongoose, { Schema, Document } from "mongoose";

export interface IPreset {
  slippage: number;
  priorityFee: string;
  bribeAmount: string;
  // amazonq-ignore-next-line
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
      // amazonq-ignore-next-line
      validator: (arr: any[]) => arr.length === 3,
      message: "User must have exactly 3 buy presets."
    },
    // amazonq-ignore-next-line
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

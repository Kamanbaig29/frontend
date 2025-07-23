import mongoose from "mongoose";

// amazonq-ignore-next-line
const BuyFiltersSchema = new mongoose.Schema({
  maxMcap: { type: Number, default: 0 },
  maxBuyers: { type: Number, default: 0 },
  maxTokenAge: { type: Number, default: 0 },
  antiRug: { type: Boolean, default: false },
  noBribeMode: { type: Boolean, default: false },
  minLpLockTime: { type: Number, default: 0 },
  // amazonq-ignore-next-line
  whitelistDevs: { type: [String], default: ["true"] }, // now array, default ["true"]
  blacklistDevs: { type: [String], default: ["true"] }, // now array, default ["true"]
  autoSellCondition: { type: String, default: "" },
  timeout: { type: Number, default: 0 },
  buyUntilReached: { type: Boolean, default: false },
  buyUntilMarketCap: { type: Number, default: 0 },
  buyUntilPrice: { type: Number, default: 0 },
  buyUntilAmount: { type: Number, default: 0 }
}, { _id: false });

const SellFiltersSchema = new mongoose.Schema({
  trailingStopPercent: { type: Number, default: 0 },
  timeoutSellAfterSec: { type: Number, default: 0 },
  minLiquidity: { type: Number, default: 0 },
  frontRunProtection: { type: Boolean, default: false },
  loopSellLogic: { type: Boolean, default: false },
  waitForBuyersBeforeSell: { type: Number, default: 0 },
  blockedTokens: { type: [String], default: [] }
}, { _id: false });

const UserFilterPresetSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  buyFilters: { type: BuyFiltersSchema, default: () => ({}) },
  sellFilters: { type: SellFiltersSchema, default: () => ({}) }
});

// When a new document is created, Mongoose will apply the default values specified in the schemas.
// For example, sellFilters will be initialized as an empty object, and inside it,
// blockedTokens will be initialized as an empty array.
const UserFilterPreset = mongoose.model('UserFilterPreset', UserFilterPresetSchema);

export default UserFilterPreset;

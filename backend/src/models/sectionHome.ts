import mongoose, { Schema, Document } from "mongoose";

interface IFilterItem {
  sectionTitle: string;
  sortOrder?: "asc" | "desc";
  filters?: { [key: string]: { min: string; max: string } };
}

const TokenSectionFilterSchema = new mongoose.Schema<IFilterItem>(
  {
    sectionTitle: { type: String, required: true },
    sortOrder: { type: String, enum: ["asc", "desc"], default: "desc" },
    filters: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

interface ISectionModalFilters extends Document {
  userId: string;
  firstDrops: IFilterItem[];
  heatingUp: IFilterItem[];
  battleTested: IFilterItem[];
}

const SectionModalFilterSchema = new mongoose.Schema<ISectionModalFilters>(
  {
    userId: { type: String, required: true, unique: true },
    firstDrops: { type: [TokenSectionFilterSchema], default: [] },
    heatingUp: { type: [TokenSectionFilterSchema], default: [] },
    battleTested: { type: [TokenSectionFilterSchema], default: [] },
  },
  { timestamps: true }
);

const SectionModalFilters = mongoose.model<ISectionModalFilters>(
  "SectionModalFilters",
  SectionModalFilterSchema
);

export default SectionModalFilters;
export { ISectionModalFilters, IFilterItem };
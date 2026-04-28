import mongoose from "mongoose";

const opportunitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    category: {
      type: String,
      enum: ["career", "investment", "education", "relationship", "health", "creative", "other"],
      default: "other",
    },
    region: { type: String },
    score: { type: Number, default: 0 },
    momentum: { type: Number, default: 0 },
    sourceUrl: { type: String },
    sourceName: { type: String },
    references: {
      type: [
        new mongoose.Schema(
          { title: String, url: String, why: String },
          { _id: false }
        ),
      ],
      default: [],
    },
    tags: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

opportunitySchema.index({ userId: 1, category: 1 });
opportunitySchema.index({ score: -1 });

const Opportunity = mongoose.models.Opportunity || mongoose.model("Opportunity", opportunitySchema);
export default Opportunity;

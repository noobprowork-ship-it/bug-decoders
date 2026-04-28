import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String },
    voicePrintId: { type: String },
    avatarUrl: { type: String },
    tier: { type: String, enum: ["free", "pro", "enterprise"], default: "free" },
    identityProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    mindProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;

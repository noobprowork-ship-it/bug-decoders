import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["system", "user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["chat", "voice", "mind", "multiverse", "cinematic", "decision", "identity", "goie"],
      default: "chat",
    },
    title: { type: String },
    messages: { type: [messageSchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

const Session = mongoose.models.Session || mongoose.model("Session", sessionSchema);
export default Session;

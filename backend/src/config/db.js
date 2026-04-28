import mongoose from "mongoose";

// Fail fast on Mongoose calls when no DB connection has been established.
// Default buffering timeout is 10s which makes test suites + error UIs hang.
mongoose.set("bufferTimeoutMS", 1500);

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[db] MONGODB_URI is not set — skipping MongoDB connection.");
    return null;
  }

  try {
    mongoose.set("strictQuery", true);
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[db] MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error("[db] MongoDB connection error:", err.message);
    throw err;
  }
}

export default connectDB;

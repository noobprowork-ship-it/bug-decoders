import mongoose from "mongoose";

export function dbReady() {
  return mongoose.connection?.readyState === 1;
}

export async function tryDB(fn, fallback = null) {
  if (!dbReady()) return fallback;
  try {
    return await fn();
  } catch (err) {
    console.warn("[db] operation skipped:", err.message);
    return fallback;
  }
}

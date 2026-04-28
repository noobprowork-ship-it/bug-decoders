import fs from "fs";
import { toFile } from "openai";
import { openai, isAIConfigured } from "../config/openai.js";

/**
 * Transcribe an audio buffer/file using the OpenAI SDK so it works with both
 * the official OpenAI endpoint and Replit AI Integrations (managed billing).
 * Accepts either a Buffer or a filesystem path.
 */
export async function transcribeAudio({ buffer, filename = "audio.webm", filePath, mimetype = "audio/webm" }) {
  if (!isAIConfigured) throw new Error("AI provider is not configured");

  let file;
  if (filePath) {
    file = await toFile(fs.createReadStream(filePath), filename, { type: mimetype });
  } else if (buffer) {
    file = await toFile(buffer, filename, { type: mimetype });
  } else {
    throw new Error("transcribeAudio requires either `buffer` or `filePath`");
  }

  const model = process.env.OPENAI_WHISPER_MODEL || "gpt-4o-mini-transcribe";

  const response = await openai.audio.transcriptions.create({
    file,
    model,
  });

  return response?.text || "";
}

/**
 * Build a lightweight "voice print id" out of a transcription. In production
 * this would be a real embedding match — here we keep it deterministic so the
 * route is wire-compatible without extra services.
 */
export function deriveVoicePrintId(transcript) {
  const cleaned = (transcript || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  let hash = 0;
  for (let i = 0; i < cleaned.length; i++) {
    hash = (hash * 31 + cleaned.charCodeAt(i)) | 0;
  }
  return `vp_${Math.abs(hash).toString(36)}`;
}

/**
 * Convenience helper used by the auth controller — transcribes uploaded audio
 * and returns both the transcript and a derived voice-print identifier.
 */
export async function processVoiceLogin(file) {
  if (!file) throw new Error("No audio file provided");
  const transcript = await transcribeAudio({
    buffer: file.buffer,
    filename: file.originalname || "voice.webm",
    mimetype: file.mimetype || "audio/webm",
  });
  return {
    transcript,
    voicePrintId: deriveVoicePrintId(transcript),
  };
}

export default processVoiceLogin;

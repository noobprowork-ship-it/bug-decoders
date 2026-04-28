import fs from "fs";
import FormData from "form-data";
import axios from "axios";
import { openai } from "../config/openai.js";

/**
 * Transcribe an audio buffer/file with the OpenAI Whisper API.
 * Accepts either a Buffer or a filesystem path.
 */
export async function transcribeAudio({ buffer, filename = "audio.webm", filePath, mimetype = "audio/webm" }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const form = new FormData();
  if (filePath) {
    form.append("file", fs.createReadStream(filePath), { filename, contentType: mimetype });
  } else if (buffer) {
    form.append("file", buffer, { filename, contentType: mimetype });
  } else {
    throw new Error("transcribeAudio requires either `buffer` or `filePath`");
  }
  form.append("model", process.env.OPENAI_WHISPER_MODEL || "whisper-1");

  const { data } = await axios.post("https://api.openai.com/v1/audio/transcriptions", form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${apiKey}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return data?.text || "";
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

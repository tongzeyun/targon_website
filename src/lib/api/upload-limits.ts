const MEBIBYTE = 1024 * 1024;

export const MAX_DOCUMENT_UPLOAD_BYTES = 50 * MEBIBYTE;
export const MAX_AUDIO_UPLOAD_BYTES = 20 * MEBIBYTE;
export const MAX_BID_UPLOAD_BYTES = 100 * MEBIBYTE;
export const SUPPORTED_AUDIO_FORMATS = "MP3/WAV/M4A/FLAC/OGG/OPUS";

export function isSupportedAudioFileName(name: string): boolean {
  return /\.(mp3|wav|m4a|flac|ogg|opus)$/i.test(name);
}

export function guessAudioMimeType(name: string, type = ""): string {
  if (type) return type;
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".opus")) return "audio/opus";
  return "application/octet-stream";
}

export function uploadExceedsLimit(
  file: { size: number },
  maxBytes: number
): boolean {
  return !Number.isFinite(file.size) || file.size < 0 || file.size > maxBytes;
}

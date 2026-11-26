import { s } from "./util";

/** Client-side canvas output is small; keep a hard cap on what reaches D1. */
export const MAX_PHOTO_BYTES = 400 * 1024;

export type PhotoInput = { bytes: Uint8Array | null; touched: boolean; error: string | null };

/** Reads the hidden photo_data field produced by the browser resizer (a
 *  centre-cropped 500×500 WebP data URL). Members and households share this one
 *  parser so the type, size and magic-byte checks cannot drift apart. */
export function parsePhoto(
  body: Record<string, unknown>,
  msg: (key: string) => string,
): PhotoInput {
  if (s(body.photo_remove) === "1") return { bytes: null, touched: true, error: null };
  const raw = s(body.photo_data);
  if (!raw) return { bytes: null, touched: false, error: null };
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw);
  if (!match) return { bytes: null, touched: true, error: msg("photo.badType") };
  let bytes: Uint8Array;
  try {
    const bin = atob(match[1]!.replace(/\s+/g, ""));
    bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return { bytes: null, touched: true, error: msg("photo.badType") };
  }
  if (bytes.length > MAX_PHOTO_BYTES) return { bytes: null, touched: true, error: msg("photo.tooLarge") };
  const webp = bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!webp) return { bytes: null, touched: true, error: msg("photo.badType") };
  return { bytes, touched: true, error: null };
}

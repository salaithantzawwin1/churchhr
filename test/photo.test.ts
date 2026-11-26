import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, parsePhoto } from "../src/photo";

/** Identity translator: these tests assert on the key the parser asks for. */
const msg = (key: string) => key;

function bytes(size: number, magic: number[] = [0x52, 0x49, 0x46, 0x46]): Uint8Array {
  const out = new Uint8Array(size);
  out.set(magic, 0);
  if (size >= 12 && magic[0] === 0x52) out.set([0x57, 0x45, 0x42, 0x50], 8);
  return out;
}

function toBase64(value: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < value.length; i += 0x8000) {
    bin += String.fromCharCode(...value.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const dataUrl = (value: Uint8Array) => `data:image/webp;base64,${toBase64(value)}`;

describe("parsePhoto", () => {
  it("leaves the photo untouched when the form carries none", () => {
    expect(parsePhoto({}, msg)).toEqual({ bytes: null, touched: false, error: null });
    expect(parsePhoto({ photo_data: "" }, msg)).toEqual({ bytes: null, touched: false, error: null });
  });

  it("clears the photo when remove is requested, even alongside new data", () => {
    expect(parsePhoto({ photo_remove: "1" }, msg))
      .toEqual({ bytes: null, touched: true, error: null });
    expect(parsePhoto({ photo_remove: "1", photo_data: dataUrl(bytes(20)) }, msg))
      .toEqual({ bytes: null, touched: true, error: null });
  });

  it("accepts a WebP data URL and returns its bytes", () => {
    const photo = bytes(40);
    const parsed = parsePhoto({ photo_data: dataUrl(photo) }, msg);
    expect(parsed.error).toBeNull();
    expect(parsed.touched).toBe(true);
    expect(parsed.bytes).toEqual(photo);
  });

  it("accepts base64 that the browser wrapped across lines", () => {
    const photo = bytes(40);
    const wrapped = toBase64(photo).replace(/(.{20})/g, "$1\n");
    const parsed = parsePhoto({ photo_data: `data:image/webp;base64,${wrapped}` }, msg);
    expect(parsed.error).toBeNull();
    expect(parsed.bytes).toEqual(photo);
  });

  it("rejects other image types", () => {
    for (const url of [
      "data:image/png;base64,iVBORw0KGgo=",
      "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      "data:image/webp,notbase64",
    ]) {
      expect(parsePhoto({ photo_data: url }, msg))
        .toEqual({ bytes: null, touched: true, error: "photo.badType" });
    }
  });

  it("rejects bytes that are not really a WebP container", () => {
    // A RIFF header alone is not enough: the WAVE form type must be refused.
    const wav = bytes(40);
    wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE" where "WEBP" belongs
    const png = bytes(40, [0x89, 0x50, 0x4e, 0x47]);
    expect(parsePhoto({ photo_data: dataUrl(wav) }, msg).error).toBe("photo.badType");
    expect(parsePhoto({ photo_data: dataUrl(png) }, msg).error).toBe("photo.badType");
    expect(parsePhoto({ photo_data: dataUrl(bytes(8)) }, msg).error).toBe("photo.badType");
  });

  it("rejects a photo over the size cap but keeps one exactly at the cap", () => {
    expect(parsePhoto({ photo_data: dataUrl(bytes(MAX_PHOTO_BYTES + 1)) }, msg))
      .toEqual({ bytes: null, touched: true, error: "photo.tooLarge" });
    const atCap = parsePhoto({ photo_data: dataUrl(bytes(MAX_PHOTO_BYTES)) }, msg);
    expect(atCap.error).toBeNull();
    expect(atCap.bytes?.length).toBe(MAX_PHOTO_BYTES);
  });
});

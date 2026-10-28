// Dates arrive as "YYYY-MM-DD" (no time) or full ISO timestamps.
const LOCALES = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" }; // English shows "15 Jul 2027"

export function formatDate(value, lang = "en") {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALES[lang] || lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
}

// Finds the video id in the usual YouTube link shapes (including Unlisted videos).
const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"];

export function youtubeId(url) {
  try {
    const u = new URL(url);
    if (!YOUTUBE_HOSTS.includes(u.hostname)) return null;
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1) || null;
    if (u.pathname.startsWith("/watch")) return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

// Phones send big photos. Shrink to at most 1280 px and re-save as JPEG (about 150-300 KB).
// Drawing onto a canvas also removes hidden GPS data from the photo.
export async function compressImage(file, maxSide = 1280, maxBytes = 900 * 1024) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const toBlob = (q) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
  let quality = 0.78;
  let blob = await toBlob(quality);
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1;
    blob = await toBlob(quality);
  }
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}
// A random UUID (version 4). crypto.randomUUID only exists on HTTPS and localhost, so on a phone
// opening http://192.168.x.x during testing it is missing. getRandomValues works everywhere.
export function newUuid() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
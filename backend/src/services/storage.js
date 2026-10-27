// All image files go through here. Today they live in a folder (a Docker volume
// in production). To move to cloud storage later, only this file changes.
const fs = require("fs/promises");
const path = require("path");
const env = require("../config/env");
const AppError = require("../utils/AppError");
const { fileKey } = require("../utils/ids");

const NAME_PATTERN = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

// Look at the first bytes to find the real type. The browser-reported type can be faked.
function detectExtension(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return ".png";
  }
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return ".webp";
  }
  return null;
}

async function save(buffer) {
  const ext = detectExtension(buffer);
  if (!ext) throw new AppError(415, "UNSUPPORTED_FILE", "That file is not a valid image");
  await fs.mkdir(env.uploadDir, { recursive: true });
  const name = fileKey() + ext;
  await fs.writeFile(path.join(env.uploadDir, name), buffer);
  return name;
}

// Returns the full disk path, or throws 404 for anything that is not one of our file names.
function pathFor(name) {
  if (!NAME_PATTERN.test(name)) throw new AppError(404, "NOT_FOUND", "File not found");
  return path.join(env.uploadDir, name);
}

async function remove(name) {
  try {
    await fs.unlink(pathFor(name));
  } catch {
    /* already gone: nothing to do */
  }
}

module.exports = { save, pathFor, remove };

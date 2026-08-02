/* eslint-disable @typescript-eslint/no-require-imports -- Electron main process is CommonJS */
"use strict";

const { createHash, verify } = require("node:crypto");
const { createReadStream } = require("node:fs");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const RELEASE_BASE_URL =
  "https://github.com/Artem-Levchenko-hub/Fitness-AI/releases/download";
const SIGNATURE_SCHEMA_VERSION = 1;
const MAX_SIGNATURE_MANIFEST_LENGTH = 16_384;
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function expectedInstallerName(version) {
  if (!VERSION_RE.test(version)) throw new Error("Invalid update version");
  return `Vibe-trainer-Windows-x64-Setup-v${version}.exe`;
}

function signatureAssetName(version) {
  return `${expectedInstallerName(version)}.update.json`;
}

function createSignatureMessage({ version, file, sha512 }) {
  return [String(SIGNATURE_SCHEMA_VERSION), version, file, sha512].join("\n");
}

function hashFileSha512(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function validateSignatureManifest(manifest, version, sha512) {
  const file = expectedInstallerName(version);
  if (
    !manifest ||
    manifest.schemaVersion !== SIGNATURE_SCHEMA_VERSION ||
    manifest.version !== version ||
    manifest.file !== file ||
    manifest.sha512 !== sha512 ||
    !/^[a-f0-9]{128}$/.test(manifest.sha512) ||
    typeof manifest.signature !== "string"
  ) {
    throw new Error("Update signature manifest does not match the installer");
  }

  const signature = Buffer.from(manifest.signature, "base64");
  if (signature.length !== 64) throw new Error("Invalid update signature");
  return { file, signature };
}

async function verifyDownloadedUpdate({
  downloadedFile,
  version,
  publicKeyPath,
  fetchFn = fetch,
}) {
  const expectedFile = expectedInstallerName(version);
  if (path.basename(downloadedFile) !== expectedFile) {
    throw new Error("Downloaded update has an unexpected filename");
  }

  const signatureUrl = `${RELEASE_BASE_URL}/v${version}/${signatureAssetName(version)}`;
  const response = await fetchFn(signatureUrl, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Update signature request failed: ${response.status}`);

  const text = await response.text();
  if (text.length > MAX_SIGNATURE_MANIFEST_LENGTH) {
    throw new Error("Update signature manifest is too large");
  }

  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw new Error("Update signature manifest is invalid JSON");
  }

  const sha512 = await hashFileSha512(downloadedFile);
  const { signature } = validateSignatureManifest(manifest, version, sha512);
  const publicKey = await readFile(publicKeyPath, "utf8");
  const message = Buffer.from(createSignatureMessage(manifest), "utf8");
  if (!verify(null, message, publicKey, signature)) {
    throw new Error("Update signature verification failed");
  }
  return true;
}

function createUpdateVerifier({ publicKeyPath, fetchFn }) {
  return ({ downloadedFile, version }) =>
    verifyDownloadedUpdate({ downloadedFile, version, publicKeyPath, fetchFn });
}

module.exports = {
  SIGNATURE_SCHEMA_VERSION,
  createSignatureMessage,
  createUpdateVerifier,
  expectedInstallerName,
  hashFileSha512,
  signatureAssetName,
  validateSignatureManifest,
  verifyDownloadedUpdate,
};

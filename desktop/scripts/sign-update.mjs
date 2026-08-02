import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  SIGNATURE_SCHEMA_VERSION,
  createSignatureMessage,
  expectedInstallerName,
  hashFileSha512,
} = require("../update-verifier");

const [installerPath, version, privateKeyPath, publicKeyPath, outputPath] =
  process.argv.slice(2);
if (!installerPath || !version || !privateKeyPath || !publicKeyPath || !outputPath) {
  throw new Error(
    "Usage: sign-update.mjs <installer> <version> <private-key> <public-key> <output>",
  );
}

const file = expectedInstallerName(version);
if (path.basename(installerPath) !== file) {
  throw new Error(`Expected installer filename ${file}`);
}

const sha512 = await hashFileSha512(installerPath);
const privateKey = createPrivateKey(await readFile(privateKeyPath, "utf8"));
const unsignedManifest = {
  schemaVersion: SIGNATURE_SCHEMA_VERSION,
  version,
  file,
  sha512,
};
const message = Buffer.from(createSignatureMessage(unsignedManifest), "utf8");
const signature = sign(null, message, privateKey);
const publicKey = createPublicKey(await readFile(publicKeyPath, "utf8"));
if (!verify(null, message, publicKey, signature)) {
  throw new Error("Signing key does not match the public key embedded in the app");
}

await writeFile(
  outputPath,
  `${JSON.stringify({ ...unsignedManifest, signature: signature.toString("base64") }, null, 2)}\n`,
  "utf8",
);

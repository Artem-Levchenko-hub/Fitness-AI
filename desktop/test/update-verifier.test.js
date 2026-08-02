/* eslint-disable @typescript-eslint/no-require-imports -- Node test and Electron sources are CommonJS */
"use strict";

const assert = require("node:assert/strict");
const { createPublicKey, generateKeyPairSync, sign } = require("node:crypto");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  SIGNATURE_SCHEMA_VERSION,
  createSignatureMessage,
  expectedInstallerName,
  hashFileSha512,
  verifyDownloadedUpdate,
} = require("../update-verifier");

test("публичный ключ обновлений сохранён в валидном формате", async () => {
  const key = await readFile(path.join(__dirname, "..", "update-public-key.pem"), "utf8");
  assert.equal(createPublicKey(key).asymmetricKeyType, "ed25519");
});

async function createSignedFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fitness-update-test-"));
  const version = "1.3.0";
  const downloadedFile = path.join(directory, expectedInstallerName(version));
  await writeFile(downloadedFile, "trusted installer bytes");
  const sha512 = await hashFileSha512(downloadedFile);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const unsigned = {
    schemaVersion: SIGNATURE_SCHEMA_VERSION,
    version,
    file: expectedInstallerName(version),
    sha512,
  };
  const signature = sign(
    null,
    Buffer.from(createSignatureMessage(unsigned), "utf8"),
    privateKey,
  ).toString("base64");
  const publicKeyPath = path.join(directory, "public.pem");
  await writeFile(
    publicKeyPath,
    publicKey.export({ type: "spki", format: "pem" }),
  );
  const manifest = JSON.stringify({ ...unsigned, signature });
  const fetchFn = async () => new Response(manifest, { status: 200 });
  return { directory, downloadedFile, fetchFn, publicKeyPath, version };
}

test("принимает установщик с корректной Ed25519-подписью", async () => {
  const fixture = await createSignedFixture();
  try {
    await assert.doesNotReject(() => verifyDownloadedUpdate(fixture));
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test("отклоняет изменённый установщик", async () => {
  const fixture = await createSignedFixture();
  try {
    await writeFile(fixture.downloadedFile, "tampered installer bytes");
    await assert.rejects(
      () => verifyDownloadedUpdate(fixture),
      /does not match the installer/,
    );
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

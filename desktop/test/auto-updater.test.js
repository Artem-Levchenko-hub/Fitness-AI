/* eslint-disable @typescript-eslint/no-require-imports -- Node test and Electron sources are CommonJS */
"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const {
  CHECK_INTERVAL_MS,
  INITIAL_CHECK_DELAY_MS,
  createAutoUpdateController,
} = require("../auto-updater");

function createFixture(overrides = {}) {
  const { readyResponse = 0, ...controllerOverrides } = overrides;
  const autoUpdater = new EventEmitter();
  autoUpdater.checks = 0;
  autoUpdater.installs = [];
  autoUpdater.checkForUpdates = async () => {
    autoUpdater.checks += 1;
  };
  autoUpdater.quitAndInstall = (...args) => autoUpdater.installs.push(args);

  const messages = [];
  const dialog = {
    showMessageBox: async (...args) => {
      const options = args.at(-1);
      messages.push(options);
      return {
        response: options.title === "Обновление готово" ? readyResponse : 1,
      };
    },
  };

  const timeouts = [];
  const intervals = [];
  const controller = createAutoUpdateController({
    app: { isPackaged: true, getVersion: () => "1.2.0" },
    autoUpdater,
    dialog,
    getWindow: () => null,
    verifyUpdate: async () => true,
    logger: { info() {}, warn() {} },
    platform: "win32",
    setTimeoutFn: (callback, delay) => {
      timeouts.push({ callback, delay });
      return timeouts.length;
    },
    clearTimeoutFn() {},
    setIntervalFn: (callback, delay) => {
      intervals.push({ callback, delay });
      return intervals.length;
    },
    clearIntervalFn() {},
    ...controllerOverrides,
  });

  return { autoUpdater, controller, intervals, messages, timeouts };
}

test("проверяет обновление после старта и затем каждые шесть часов", async () => {
  const fixture = createFixture();

  fixture.controller.start();

  assert.equal(fixture.timeouts[0].delay, INITIAL_CHECK_DELAY_MS);
  assert.equal(fixture.intervals[0].delay, CHECK_INTERVAL_MS);
  fixture.timeouts[0].callback();
  await Promise.resolve();
  assert.equal(fixture.autoUpdater.checks, 1);
});

test("ручная проверка сообщает, когда установлена последняя версия", async () => {
  const fixture = createFixture();

  await fixture.controller.checkNow({ manual: true });
  fixture.autoUpdater.emit("update-not-available", { version: "1.2.0" });
  await Promise.resolve();

  assert.equal(fixture.messages.at(-1).title, "Vibe-trainer обновлён");
});

test("проверенный установщик запускается после подтверждения", async () => {
  const fixture = createFixture();

  fixture.autoUpdater.emit("update-downloaded", {
    version: "1.3.0",
    downloadedFile: "Vibe-trainer-Windows-x64-Setup-v1.3.0.exe",
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(fixture.messages.at(-1).title, "Обновление готово");
  assert.deepEqual(fixture.autoUpdater.installs, [[false, true]]);
  assert.equal(fixture.autoUpdater.autoInstallOnAppQuit, false);
});

test("блокирует установщик с неверной Ed25519-подписью", async () => {
  const fixture = createFixture({
    verifyUpdate: async () => {
      throw new Error("bad signature");
    },
  });

  fixture.autoUpdater.emit("update-downloaded", {
    version: "1.3.0",
    downloadedFile: "Vibe-trainer-Windows-x64-Setup-v1.3.0.exe",
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(fixture.messages.at(-1).title, "Обновление заблокировано");
  assert.deepEqual(fixture.autoUpdater.installs, []);
  assert.equal(fixture.autoUpdater.autoInstallOnAppQuit, false);
});

test("не повторяет предложение для отложенной версии", async () => {
  const fixture = createFixture({ readyResponse: 1 });
  const event = {
    version: "1.3.0",
    downloadedFile: "Vibe-trainer-Windows-x64-Setup-v1.3.0.exe",
  };

  fixture.autoUpdater.emit("update-downloaded", event);
  await new Promise((resolve) => setImmediate(resolve));
  fixture.autoUpdater.emit("update-downloaded", event);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(fixture.messages.length, 1);
  assert.deepEqual(fixture.autoUpdater.installs, []);
  assert.equal(fixture.autoUpdater.autoInstallOnAppQuit, true);
});

test("не переносит разрешение на новую версию, пока пользователь отвечает на старую", async () => {
  let resolveDialog;
  const dialog = {
    showMessageBox: async (...args) => {
      const options = args.at(-1);
      if (options.title !== "Обновление готово") return { response: 1 };
      return new Promise((resolve) => { resolveDialog = resolve; });
    },
  };
  const fixture = createFixture({ dialog });

  fixture.autoUpdater.emit("update-downloaded", {
    version: "1.3.0",
    downloadedFile: "Vibe-trainer-Windows-x64-Setup-v1.3.0.exe",
  });
  await new Promise((resolve) => setImmediate(resolve));
  fixture.autoUpdater.emit("update-downloaded", {
    version: "1.4.0",
    downloadedFile: "Vibe-trainer-Windows-x64-Setup-v1.4.0.exe",
  });
  resolveDialog({ response: 1 });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(fixture.autoUpdater.installs, []);
  assert.equal(fixture.autoUpdater.autoInstallOnAppQuit, false);
});

test("новая доступная версия отзывает отложенное разрешение", async () => {
  const fixture = createFixture({ readyResponse: 1 });
  fixture.autoUpdater.emit("update-downloaded", {
    version: "1.3.0",
    downloadedFile: "Vibe-trainer-Windows-x64-Setup-v1.3.0.exe",
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fixture.autoUpdater.autoInstallOnAppQuit, true);

  fixture.autoUpdater.emit("update-available", { version: "1.4.0" });

  assert.equal(fixture.autoUpdater.autoInstallOnAppQuit, false);
});

test("в dev-режиме не обращается к серверу обновлений", async () => {
  const fixture = createFixture({
    app: { isPackaged: false, getVersion: () => "1.2.0" },
  });

  fixture.controller.start();
  const result = await fixture.controller.checkNow({ manual: true });

  assert.deepEqual(result, { supported: false });
  assert.equal(fixture.autoUpdater.checks, 0);
  assert.equal(fixture.messages.at(-1).title, "Проверка обновлений");
});

/* eslint-disable @typescript-eslint/no-require-imports -- Node tests load CommonJS desktop policy. */
"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  APP_ORIGIN,
  isAllowedExternalUrl,
  isAppUrl,
  secureWebContents,
} = require("../security-policy");

function createWebContents() {
  const events = new Map();
  const session = {
    setDevicePermissionHandler(handler) { this.devicePermissionHandler = handler; },
    setPermissionCheckHandler(handler) { this.permissionCheckHandler = handler; },
    setPermissionRequestHandler(handler) { this.permissionRequestHandler = handler; },
  };
  return {
    session,
    on(event, handler) { events.set(event, handler); },
    setWindowOpenHandler(handler) { this.windowOpenHandler = handler; },
    trigger(event, ...args) { return events.get(event)(...args); },
  };
}

test("разрешает только точный HTTPS origin приложения", () => {
  assert.equal(isAppUrl(`${APP_ORIGIN}/dashboard`), true);
  assert.equal(isAppUrl("http://fitnesss.online/dashboard"), false);
  assert.equal(isAppUrl("https://fitnesss.online.evil.example/dashboard"), false);
  assert.equal(isAppUrl("file:///tmp/offline.html"), false);
});

test("разрешает браузеру только доверенные HTTPS адреса", () => {
  assert.equal(isAllowedExternalUrl("https://github.com/Artem-Levchenko-hub/Fitness-AI"), true);
  assert.equal(isAllowedExternalUrl("https://yoomoney.ru/checkout"), true);
  assert.equal(isAllowedExternalUrl("https://payments.yookassa.ru/checkout/safe"), true);
  assert.equal(isAllowedExternalUrl("mailto:owner@example.com"), false);
  assert.equal(isAllowedExternalUrl("file:///C:/Windows/System32/calc.exe"), false);
  assert.equal(isAllowedExternalUrl("https://github.com.evil.example/"), false);
  assert.equal(isAllowedExternalUrl("https://user:password@github.com/"), false);
});

test("запрещает permissions и навигацию на недоверенные адреса", async () => {
  const webContents = createWebContents();
  const opened = [];
  secureWebContents(webContents, {
    shell: { openExternal: async (url) => opened.push(url) },
    logger: { warn() {} },
  });

  assert.equal(webContents.session.permissionCheckHandler(), false);
  assert.equal(webContents.session.devicePermissionHandler(), false);
  let granted = true;
  webContents.session.permissionRequestHandler(null, "media", (value) => { granted = value; });
  assert.equal(granted, false);
  assert.deepEqual(webContents.windowOpenHandler({ url: "https://evil.example/" }), { action: "deny" });
  assert.deepEqual(webContents.windowOpenHandler({ url: "https://github.com/Artem-Levchenko-hub/Fitness-AI" }), { action: "deny" });
  await Promise.resolve();
  assert.deepEqual(opened, ["https://github.com/Artem-Levchenko-hub/Fitness-AI"]);

  let prevented = false;
  webContents.trigger("will-navigate", { preventDefault() { prevented = true; } }, "https://evil.example/");
  assert.equal(prevented, true);
  let webviewPrevented = false;
  webContents.trigger("will-attach-webview", { preventDefault() { webviewPrevented = true; } });
  assert.equal(webviewPrevented, true);
});

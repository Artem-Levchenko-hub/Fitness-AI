"use strict";

const APP_ORIGIN = "https://fitnesss.online";

// This is intentionally a small, explicit list.  Desktop must never turn an
// arbitrary URL controlled by a web page into an OS-level protocol launch.
const EXTERNAL_HTTPS_HOSTS = new Set([
  "github.com",
  "play.google.com",
  "payments.yookassa.ru",
  "support.google.com",
  "yookassa.ru",
  "yoomoney.ru",
]);

function toUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isAppUrl(value) {
  const url = toUrl(value);
  return url?.protocol === "https:" && url.origin === APP_ORIGIN;
}

function isAllowedExternalUrl(value) {
  const url = toUrl(value);
  if (!url || url.protocol !== "https:" || url.username || url.password) return false;

  return EXTERNAL_HTTPS_HOSTS.has(url.hostname);
}

function denyPermission(_webContents, _permission, callback) {
  callback(false);
}

/**
 * Applies the same policy to every Electron WebContents: the remote app can
 * stay on its exact HTTPS origin, while only a small list of HTTPS destinations
 * may be opened by the OS browser. All browser/device permissions are denied.
 */
function secureWebContents(webContents, { shell, logger = console }) {
  webContents.session.setPermissionCheckHandler(() => false);
  webContents.session.setPermissionRequestHandler(denyPermission);
  webContents.session.setDevicePermissionHandler(() => false);

  webContents.on("will-attach-webview", (event) => event.preventDefault());
  webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url).catch((error) => logger.warn("Cannot open trusted external URL", error));
    }
    return { action: "deny" };
  });
  webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url).catch((error) => logger.warn("Cannot open trusted external URL", error));
    }
  });
}

module.exports = {
  APP_ORIGIN,
  isAllowedExternalUrl,
  isAppUrl,
  secureWebContents,
};

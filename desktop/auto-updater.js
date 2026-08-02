"use strict";

const INITIAL_CHECK_DELAY_MS = 10_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;

function showMessage(dialog, getWindow, options) {
  const owner = getWindow();
  return owner && !owner.isDestroyed()
    ? dialog.showMessageBox(owner, options)
    : dialog.showMessageBox(options);
}

/**
 * Настраивает обновления только для установленной Windows-сборки.
 * Зависимости передаются явно, чтобы весь жизненный цикл можно было проверить
 * без запуска Electron и без обращения к GitHub.
 */
function createAutoUpdateController({
  app,
  autoUpdater,
  dialog,
  getWindow,
  verifyUpdate,
  logger = console,
  platform = process.platform,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}) {
  const supported = platform === "win32" && app.isPackaged;
  let initialTimer = null;
  let intervalTimer = null;
  let manualCheck = false;
  let promptingForRestart = false;
  let deferredVersion = null;
  let approvedVersion = null;
  let updateGeneration = 0;

  const listeners = [];
  const listen = (event, handler) => {
    autoUpdater.on(event, handler);
    listeners.push([event, handler]);
  };

  const showNoUpdate = async (version) => {
    await showMessage(dialog, getWindow, {
      type: "info",
      title: "Vibe-trainer обновлён",
      message: "Установлена последняя версия",
      detail: `Текущая версия: ${version || app.getVersion()}`,
      buttons: ["Хорошо"],
      defaultId: 0,
    });
  };

  const showUpdateError = async () => {
    await showMessage(dialog, getWindow, {
      type: "warning",
      title: "Не удалось проверить обновление",
      message: "Проверьте подключение к интернету и попробуйте ещё раз.",
      buttons: ["Хорошо"],
      defaultId: 0,
    });
  };

  const onError = (error) => {
    updateGeneration += 1;
    approvedVersion = null;
    deferredVersion = null;
    autoUpdater.autoInstallOnAppQuit = false;
    logger.warn("Desktop auto-update failed", error);
    if (manualCheck) void showUpdateError();
    manualCheck = false;
  };

  if (supported) {
    autoUpdater.autoDownload = true;
    // Неподписанный NSIS нельзя доверять только по latest.yml: разрешаем
    // установку при выходе лишь после отдельной Ed25519-проверки бинарника.
    autoUpdater.autoInstallOnAppQuit = false;

    listen("update-available", (info) => {
      // A later candidate must never inherit an earlier candidate's approval.
      updateGeneration += 1;
      approvedVersion = null;
      deferredVersion = null;
      autoUpdater.autoInstallOnAppQuit = false;
      manualCheck = false;
      logger.info(`Downloading Vibe-trainer ${info.version}`);
    });

    listen("update-not-available", (info) => {
      if (manualCheck) void showNoUpdate(info.version);
      manualCheck = false;
    });

    listen("update-downloaded", async (info) => {
      // Repeated notification for the exact deferred, verified binary is safe.
      if (
        !promptingForRestart &&
        deferredVersion === info.version &&
        approvedVersion === info.version
      ) return;

      // Fail closed before any asynchronous verification or user interaction.
      const generation = ++updateGeneration;
      approvedVersion = null;
      deferredVersion = null;
      autoUpdater.autoInstallOnAppQuit = false;
      if (promptingForRestart) return;
      promptingForRestart = true;
      try {
        await verifyUpdate({
          downloadedFile: info.downloadedFile,
          version: info.version,
        });
        const result = await showMessage(dialog, getWindow, {
          type: "info",
          title: "Обновление готово",
          message: `Vibe-trainer ${info.version} уже загружен`,
          detail:
            "Перезапустите приложение сейчас или продолжайте работу — обновление установится при следующем выходе.",
          buttons: ["Перезапустить сейчас", "Позже"],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
        });
        // A second update event may have arrived while the dialog was open.
        // Never apply a candidate that was not the one just verified.
        if (generation !== updateGeneration) return;
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true);
        } else {
          deferredVersion = info.version;
          approvedVersion = info.version;
          autoUpdater.autoInstallOnAppQuit = true;
        }
      } catch (error) {
        logger.warn("Downloaded update signature is invalid", error);
        approvedVersion = null;
        deferredVersion = null;
        autoUpdater.autoInstallOnAppQuit = false;
        await showMessage(dialog, getWindow, {
          type: "error",
          title: "Обновление заблокировано",
          message: "Не удалось подтвердить подлинность установщика.",
          detail:
            "Приложение не будет устанавливать этот файл. Попробуйте позже или скачайте версию с официальной страницы GitHub.",
          buttons: ["Хорошо"],
          defaultId: 0,
        });
      } finally {
        promptingForRestart = false;
      }
    });

    listen("error", onError);
  }

  async function checkNow({ manual = false } = {}) {
    if (!supported) {
      if (manual) {
        await showMessage(dialog, getWindow, {
          type: "info",
          title: "Проверка обновлений",
          message:
            "Автообновление доступно в установленной версии Vibe-trainer для Windows.",
          buttons: ["Хорошо"],
          defaultId: 0,
        });
      }
      return { supported: false };
    }

    manualCheck = manual;
    try {
      await autoUpdater.checkForUpdates();
      return { supported: true };
    } catch (error) {
      onError(error);
      return { supported: true, error };
    }
  }

  function start() {
    if (!supported || initialTimer || intervalTimer) return;
    initialTimer = setTimeoutFn(() => {
      initialTimer = null;
      void checkNow();
    }, INITIAL_CHECK_DELAY_MS);
    intervalTimer = setIntervalFn(() => void checkNow(), CHECK_INTERVAL_MS);
  }

  function dispose() {
    if (initialTimer) clearTimeoutFn(initialTimer);
    if (intervalTimer) clearIntervalFn(intervalTimer);
    initialTimer = null;
    intervalTimer = null;
    for (const [event, handler] of listeners) {
      autoUpdater.removeListener(event, handler);
    }
    listeners.length = 0;
  }

  return { checkNow, dispose, start, supported };
}

module.exports = {
  CHECK_INTERVAL_MS,
  INITIAL_CHECK_DELAY_MS,
  createAutoUpdateController,
};

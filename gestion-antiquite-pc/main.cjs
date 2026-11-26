const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, Menu, dialog, session, shell } = require('electron');

const APP_DISPLAY_NAME = 'gestion antiquite PC';
app.setName(APP_DISPLAY_NAME);

let mainWindow = null;

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 3000;
      server.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else if (Date.now() < deadline) {
          setTimeout(ping, 120);
        } else {
          reject(new Error(`Server responded with status ${res.statusCode}`));
        }
      });
      req.on('error', () => {
        if (Date.now() < deadline) {
          setTimeout(ping, 120);
        } else {
          reject(new Error('Local backend server did not start in time'));
        }
      });
    };
    ping();
  });
}

function getAppRoot() {
  if (app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'app');
    if (fs.existsSync(unpacked)) {
      return unpacked;
    }
  }
  return path.join(__dirname, 'app');
}

async function startLocalBackend() {
  const port = await findFreePort();
  const dataDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const appRoot = getAppRoot();
  const serverMjs = path.join(__dirname, 'app', 'server.mjs');
  if (!fs.existsSync(serverMjs)) {
    throw new Error(`Bundled backend missing at ${serverMjs}`);
  }

  process.env.NODE_ENV = 'production';
  process.env.HOST = '127.0.0.1';
  process.env.PORT = String(port);
  process.env.DATA_DIR = dataDir;
  process.env.APP_ROOT = appRoot;
  process.env.APP_URL = `http://127.0.0.1:${port}`;

  await import(pathToFileURL(serverMjs).href);
  await waitForServer(`http://127.0.0.1:${port}/api/settings`);
  return `http://127.0.0.1:${port}`;
}

function createMainWindow(baseUrl) {
  const iconPath = path.join(__dirname, 'resources', 'icon.png');
  mainWindow = new BrowserWindow({
    title: APP_DISPLAY_NAME,
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(baseUrl)) {
      return { action: 'allow' };
    }
    if (/^https?:\/\//i.test(url) || /^whatsapp:/i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(baseUrl);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);

    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowed = ['media', 'mediaKeySystem', 'clipboard-read', 'clipboard-sanitized-write'];
      callback(allowed.includes(permission));
    });

    try {
      const baseUrl = await startLocalBackend();
      createMainWindow(baseUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dialog.showErrorBox(APP_DISPLAY_NAME, `Impossible de démarrer le serveur local :\n${message}`);
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

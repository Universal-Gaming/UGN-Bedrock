'use strict';
const { app, BrowserWindow, Menu, session, shell, dialog } = require('electron');
const { HOME, isUGNPage, canOpenExternal } = require('./url-policy.cjs');

let mainWindow;
app.setAppUserModelId('us.universalgaming.java');

function openOutside(url) {
  if (canOpenExternal(url)) void shell.openExternal(url).catch(() => {});
}
function createWindow() {
  const win = new BrowserWindow({
    title: 'UGN Java | MC Browser Edition',
    width: 1280, height: 820, minWidth: 740, minHeight: 580,
    backgroundColor: '#080d20',
    show: false,
    autoHideMenuBar: true,
    icon: require('path').join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      partition: 'persist:ugn-java',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      spellcheck: false
    }
  });
  mainWindow = win;
  const ses = win.webContents.session;
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    // SECURITY: use the actual requesting URL, not only the top-level frame.
    const requesting = details?.requestingUrl || wc.getURL();
    callback(isUGNPage(requesting) && ['pointerLock', 'fullscreen'].includes(permission));
  });
  ses.setPermissionCheckHandler((wc, permission, requestingOrigin, details) => {
    const requesting = details?.requestingUrl || requestingOrigin;
    return isUGNPage(requesting) && ['pointerLock', 'fullscreen'].includes(permission);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isUGNPage(url)) { event.preventDefault(); openOutside(url); }
  });
  win.webContents.on('will-redirect', (event, url) => {
    if (!isUGNPage(url)) { event.preventDefault(); openOutside(url); }
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.webContents.on('render-process-gone', () => {
    if (!win.isDestroyed()) void dialog.showMessageBox(win, {
      type: 'warning', title: 'UGN Java',
      message: 'The game renderer stopped. Reload the window to return to UGN Java.',
      buttons: ['OK']
    });
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'UGN Java', submenu: [
      { label: 'UGN Home', click: () => void win.loadURL(HOME) },
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win.webContents.reload() },
      { label: 'Fullscreen', accelerator: 'F11', click: () => win.setFullScreen(!win.isFullScreen()) },
      { type: 'separator' }, { role: 'quit' }
    ]}
  ]));
  void win.loadURL(HOME).catch(() => {
    if (!win.isDestroyed()) void dialog.showMessageBox(win, {
      type:'error', title:'UGN Java is offline',
      message: 'The game website could not be reached. Check your internet connection.',
      buttons:['OK']
    });
  });
  win.once('ready-to-show', () => win.show());
  setTimeout(() => { if (!win.isDestroyed()) win.show(); }, 4500).unref?.();
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// Bikemoko for Windows. A thin Electron shell around the built web app (dist/index.html).
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const isExternal = (url) => /^(https?:|mailto:|tel:|sms:|smsto:|viber:)/i.test(url);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0b0d',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Blank pop-ups (window.open('') used for printing labels, POs, pick-lists, quotes) open as normal
  // child windows. http(s) links go to the normal browser. Anything else is refused.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank') return { action: 'allow' };
    if (isExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Never navigate the app window away from the local app: sms:, viber:, mailto:, http(s) open outside.
  const guardNav = (event, url) => {
    if (url.startsWith('file:')) return;
    event.preventDefault();
    if (isExternal(url)) shell.openExternal(url);
  };
  win.webContents.on('will-navigate', guardNav);
  win.webContents.on('will-frame-navigate', guardNav);

  // Printing: receipts and job tickets use window.print(); Ctrl+P also opens the print dialog.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.control && !input.alt && !input.shift && input.key.toLowerCase() === 'p') {
      event.preventDefault();
      win.webContents.print({ silent: false, printBackground: true });
    }
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => app.quit());
}

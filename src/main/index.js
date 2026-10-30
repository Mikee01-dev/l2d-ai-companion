const { app, BrowserWindow, screen, ipcMain, Tray, Menu, globalShortcut, nativeImage } = require('electron')
const path = require('node:path')

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    frame: false, 
    transparent: false,
    backgroundColor: '#2b2d31',
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const point = screen.getCursorScreenPoint()
      const windowBounds = mainWindow.getBounds()
      mainWindow.webContents.send('global-mouse', {
        mouseX: point.x,
        mouseY: point.y,
        winX: windowBounds.x,
        winY: windowBounds.y
      })
    }
  }, 16)

  ipcMain.on('window-close', () => {
    mainWindow.close();
  });
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function setupTrayAndShortcuts() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Tampilkan Mike', 
      click: () => mainWindow.show() 
    },
    { 
      label: 'Sembunyikan Mike', 
      click: () => mainWindow.hide() 
    },
    { type: 'separator' },
    { 
      label: 'Keluar', 
      click: () => app.quit() 
    }
  ]);
  tray.setToolTip('Mike AI Companion');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
  });

  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow()
  setupTrayAndShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
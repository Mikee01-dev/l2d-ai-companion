const { app, BrowserWindow, screen } = require('electron')
const path = require('node:path')

function createWindow() {
  const win = new BrowserWindow({
    width: 300,
    height: 600,
    frame: true,
    transparent: false,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
    },
  })

    setInterval(() => {
      if (win && !win.isDestroyed()) {
        const point = screen.getCursorScreenPoint()
        const windowBounds = win.getBounds()

        win.webContents.send('global-mouse', {
          mouseX: point.x,
          mouseY: point.y,
          winX: windowBounds.x,
          winY: windowBounds.y
        })
      }
    }, 16)

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
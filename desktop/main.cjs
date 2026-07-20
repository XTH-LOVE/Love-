const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')

const APP_URL = 'https://love-home.pages.dev/'

if (!app.requestSingleInstanceLock()) app.quit()

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f7edf9',
    icon: path.join(__dirname, '..', 'public', 'desktop-icon.png'),
    title: 'Love小家',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL) && !url.startsWith('https://soketalclkibyilenvzv.supabase.co/')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
  window.webContents.session.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'media')
  })
  window.loadURL(APP_URL)
}

app.whenReady().then(createWindow)
app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0]
  if (window) { if (window.isMinimized()) window.restore(); window.focus() }
})
app.on('window-all-closed', () => app.quit())

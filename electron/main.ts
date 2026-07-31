import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

ipcMain.handle('save-exported-file', async (_event, payload: {
  defaultName: string
  data: Uint8Array
  filters: { name: string; extensions: string[] }[]
}) => {
  const result = await dialog.showSaveDialog({
    defaultPath: path.join(app.getPath('downloads'), payload.defaultName),
    filters: payload.filters,
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  await writeFile(result.filePath, Buffer.from(payload.data))
  return { canceled: false, filePath: result.filePath }
})

function createWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f4f5f7',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111318',
      symbolColor: '#d9dde7',
      height: 42,
    },
    webPreferences: {
      preload: path.join(currentDir, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void window.loadFile(path.join(currentDir, '../dist/index.html'))
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

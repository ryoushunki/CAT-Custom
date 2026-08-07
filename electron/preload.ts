import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('catApp', {
  platform: process.platform,
  version: '0.5.0',
  saveExportedFile: (payload: {
    defaultName: string
    data: Uint8Array
    filters: { name: string; extensions: string[] }[]
  }) => ipcRenderer.invoke('save-exported-file', payload),
})

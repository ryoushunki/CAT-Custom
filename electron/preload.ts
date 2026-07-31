import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('catApp', {
  platform: process.platform,
  version: '0.1.0',
})

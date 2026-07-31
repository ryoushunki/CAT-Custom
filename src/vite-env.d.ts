/// <reference types="vite/client" />

interface Window {
  catApp?: {
    platform: string
    version: string
    saveExportedFile: (payload: {
      defaultName: string
      data: Uint8Array
      filters: { name: string; extensions: string[] }[]
    }) => Promise<{ canceled: boolean; filePath?: string }>
  }
}

import { openDB, type DBSchema } from 'idb'
import type { AssetRecord, Project, ProjectFile, Segment } from './types'

interface StoredFileRecord {
  id: string
  file: ProjectFile
  segments: Segment[]
  originalFile?: ArrayBuffer
}

interface StoredAssetRecord extends AssetRecord {}

interface CatDatabase extends DBSchema {
  files: {
    key: string
    value: StoredFileRecord
  }
  assets: {
    key: string
    value: StoredAssetRecord
  }
  projects: {
    key: string
    value: Project
  }
}

const databasePromise = openDB<CatDatabase>('lingoforge-cat', 3, {
  upgrade(database) {
    if (!database.objectStoreNames.contains('files')) {
      database.createObjectStore('files', { keyPath: 'id' })
    }
    if (!database.objectStoreNames.contains('assets')) {
      database.createObjectStore('assets', { keyPath: 'id' })
    }
    if (!database.objectStoreNames.contains('projects')) {
      database.createObjectStore('projects', { keyPath: 'id' })
    }
  },
})

export async function loadFileRecords() {
  const database = await databasePromise
  return database.getAll('files')
}

export async function loadFileRecord(id: string) {
  const database = await databasePromise
  return database.get('files', id)
}

export async function saveFileRecord(file: ProjectFile, segments: Segment[], originalFile?: ArrayBuffer) {
  const database = await databasePromise
  const existing = await database.get('files', file.id)
  await database.put('files', {
    id: file.id,
    file,
    segments,
    originalFile: originalFile ?? existing?.originalFile,
  })
}

export async function loadAssetRecords() {
  const database = await databasePromise
  return database.getAll('assets')
}

export async function saveAssetRecord(asset: AssetRecord) {
  const database = await databasePromise
  await database.put('assets', asset)
}

export async function deleteAssetRecord(id: string) {
  const database = await databasePromise
  await database.delete('assets', id)
}

export async function loadProjects() {
  const database = await databasePromise
  return database.getAll('projects')
}

export async function saveProject(project: Project) {
  const database = await databasePromise
  await database.put('projects', project)
}

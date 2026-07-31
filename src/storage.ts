import { openDB, type DBSchema } from 'idb'
import type { ProjectFile, Segment } from './types'

interface StoredFileRecord {
  id: string
  file: ProjectFile
  segments: Segment[]
  originalFile?: ArrayBuffer
}

interface CatDatabase extends DBSchema {
  files: {
    key: string
    value: StoredFileRecord
  }
}

const databasePromise = openDB<CatDatabase>('lingoforge-cat', 1, {
  upgrade(database) {
    if (!database.objectStoreNames.contains('files')) {
      database.createObjectStore('files', { keyPath: 'id' })
    }
  },
})

export async function loadFileRecords() {
  const database = await databasePromise
  return database.getAll('files')
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

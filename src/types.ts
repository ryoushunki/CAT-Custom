export type SegmentStatus = 'untranslated' | 'translated' | 'review'

export interface Segment {
  id: number
  source: string
  target: string
  status: SegmentStatus
  match?: number
  note?: string
  sourceRow?: number
  protectedElements?: string[]
}

export interface ImportSettings {
  sheetName: string
  sourceColumn: number
  targetColumn: number | null
  startRow: number
  sourceLanguage: string
  targetLanguage: string
  nonTranslatablePattern: string
}

export interface ProjectFile {
  id: string
  name: string
  sourceLanguage: string
  targetLanguage: string
  progress: number
  segmentCount: number
  updatedAt: string
  importSettings?: ImportSettings
}

export interface TranslationMemoryEntry {
  id: string
  source: string
  target: string
  project: string
  fileId?: string
  segmentId?: number
}

export interface TermEntry {
  source: string
  target: string
  status: 'approved' | 'draft'
}

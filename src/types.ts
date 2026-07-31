export type SegmentStatus = 'untranslated' | 'translated' | 'review'

export interface Segment {
  id: number
  source: string
  target: string
  status: SegmentStatus
  match?: number
  note?: string
}

export interface ProjectFile {
  id: string
  name: string
  sourceLanguage: string
  targetLanguage: string
  progress: number
  segmentCount: number
  updatedAt: string
}

import { useEffect, useMemo, useRef, useState } from 'react'
import readXlsxFile from 'read-excel-file/browser'
import {
  AlertCircle,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Cloud,
  Download,
  FilePlus2,
  Files,
  Filter,
  FolderKanban,
  Languages,
  MoreHorizontal,
  PanelRightClose,
  Play,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { initialSegmentsByFile, projectFiles } from './data'
import { buildTranslatedExport } from './fileExport'
import { seedTerms, seedTranslationMemory, similarityScore } from './languageAssets'
import { deleteAssetRecord, loadAssetRecords, loadFileRecord, loadFileRecords, saveAssetRecord, saveFileRecord } from './storage'
import type { AssetKind, AssetRecord, ImportSettings, ProjectFile, Segment, SegmentStatus, TermEntry, TranslationMemoryEntry } from './types'

type FilterType = 'all' | SegmentStatus
type InspectorTab = 'suggestions' | 'ai' | 'terms'

interface ParsedSheet {
  sheet: string
  data: unknown[][]
}

interface ImportDraft {
  file: File
  originalFile: ArrayBuffer
  sheets: ParsedSheet[]
  sheetName: string
  sourceColumn: number
  targetColumn: number | null
  startRow: number
  sourceLanguage: string
  targetLanguage: string
  nonTranslatablePattern: string
}

interface AssetImportDraft {
  file: File
  kind: AssetKind
  assetName: string
  sheets: ParsedSheet[]
  sheetName: string
  sourceColumn: number
  targetColumn: number | null
  startRow: number
  sourceLanguage: string
  targetLanguage: string
  status: TermEntry['status']
}

const DEFAULT_NON_TRANSLATABLE_PATTERN = '<[^>]+>|%(?:s|d)|\\\\n|\\{[^{}]+\\}'

const languageOptions = ['简体中文', '英语', '越南语', '泰语', '韩语', '日语']

const statusLabel: Record<SegmentStatus, string> = {
  untranslated: '未翻译',
  translated: '已翻译',
  review: '待检查',
}

function cloneInitialSegments() {
  return Object.fromEntries(
    Object.entries(initialSegmentsByFile).map(([fileId, segments]) => [
      fileId,
      segments.map((segment) => ({ ...segment })),
    ]),
  )
}

function getProgress(segments: Segment[]) {
  if (!segments.length) return 0
  const completed = segments.filter((segment) => segment.status !== 'untranslated').length
  return Math.round((completed / segments.length) * 100)
}

function parseCsv(text: string, delimiter: ',' | '\t') {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const nextCharacter = text[index + 1]

    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === delimiter && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }

  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

function normalizeRows(rows: unknown[][]) {
  return rows.map((row) => row.map((cell) => (cell == null ? '' : String(cell))))
}

function looksLikeHeader(rows: unknown[][], sourceColumn = 0, targetColumn: number | null = 1) {
  const firstRow = normalizeRows(rows)[0]?.map((value) => value.trim().toLowerCase()) ?? []
  const sourceHeaders = ['zh', 'source', 'source text', '原文', '中文', '简体中文']
  const targetHeaders = ['target', 'translation', '译文', '翻译', '越南语', 'vi', 'en', 'th', 'ko']
  return sourceHeaders.includes(firstRow[sourceColumn]) || (targetColumn != null && targetHeaders.includes(firstRow[targetColumn]))
}

function compilePattern(pattern: string) {
  if (!pattern.trim()) return null
  return new RegExp(pattern, 'g')
}

function extractProtectedElements(source: string, pattern: string) {
  try {
    const expression = compilePattern(pattern)
    return expression ? Array.from(source.matchAll(expression), (match) => match[0]) : []
  } catch {
    return []
  }
}

function getMissingProtectedElements(segment: Segment) {
  const available = segment.target
  const usedOffsets: number[] = []
  return (segment.protectedElements ?? []).filter((element) => {
    let offset = available.indexOf(element)
    while (offset >= 0 && usedOffsets.includes(offset)) offset = available.indexOf(element, offset + element.length)
    if (offset < 0) return true
    usedOffsets.push(offset)
    return false
  })
}

function rowsToSegments(rows: unknown[][], settings: ImportSettings) {
  const normalizedRows = normalizeRows(rows)
  return normalizedRows
    .map((row, rowIndex) => ({ row, rowIndex }))
    .filter(({ rowIndex }) => rowIndex >= settings.startRow - 1)
    .filter(({ row }) => row[settings.sourceColumn]?.trim())
    .map(({ row, rowIndex }, index): Segment => {
      const source = row[settings.sourceColumn].trim()
      const target = settings.targetColumn == null ? '' : row[settings.targetColumn]?.trim() ?? ''
      return {
        id: index + 1,
        source,
        target,
        status: target ? 'review' : 'untranslated',
        sourceRow: rowIndex + 1,
        protectedElements: extractProtectedElements(source, settings.nonTranslatablePattern),
      }
    })
}

function columnName(index: number) {
  let value = index + 1
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

function ImportDialog({
  draft,
  onChange,
  onCancel,
  onConfirm,
}: {
  draft: ImportDraft
  onChange: (next: ImportDraft) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const selectedSheet = draft.sheets.find((sheet) => sheet.sheet === draft.sheetName) ?? draft.sheets[0]
  const maxColumns = Math.max(1, ...selectedSheet.data.slice(0, 30).map((row) => row.length))
  const columns = Array.from({ length: maxColumns }, (_, index) => index)
  const previewRows = normalizeRows(selectedSheet.data).slice(0, 8)
  const settings: ImportSettings = {
    sheetName: draft.sheetName,
    sourceColumn: draft.sourceColumn,
    targetColumn: draft.targetColumn,
    startRow: draft.startRow,
    sourceLanguage: draft.sourceLanguage,
    targetLanguage: draft.targetLanguage,
    nonTranslatablePattern: draft.nonTranslatablePattern,
  }

  let regexError = ''
  try {
    compilePattern(draft.nonTranslatablePattern)
  } catch {
    regexError = '正则表达式无效，请检查括号和转义符。'
  }

  const previewSegments = regexError ? [] : rowsToSegments(selectedSheet.data, settings)
  const protectedCount = previewSegments.reduce((total, segment) => total + (segment.protectedElements?.length ?? 0), 0)
  const update = (changes: Partial<ImportDraft>) => onChange({ ...draft, ...changes })

  return (
    <div className="modal-backdrop">
      <section className="import-dialog" role="dialog" aria-modal="true" aria-label="导入文件设置">
        <header className="import-dialog-header">
          <div>
            <span className="eyebrow">导入翻译文件</span>
            <h2>{draft.file.name}</h2>
          </div>
          <button className="dialog-close" onClick={onCancel} aria-label="关闭导入设置">×</button>
        </header>

        <div className="import-dialog-body">
          <div className="import-settings-grid">
            <label>
              <span>工作表</span>
              <select
                value={draft.sheetName}
                onChange={(event) => {
                  const nextSheet = draft.sheets.find((sheet) => sheet.sheet === event.target.value) ?? draft.sheets[0]
                  update({
                    sheetName: event.target.value,
                    startRow: looksLikeHeader(nextSheet.data, draft.sourceColumn, draft.targetColumn) ? 2 : 1,
                  })
                }}
              >
                {draft.sheets.map((sheet) => <option key={sheet.sheet} value={sheet.sheet}>{sheet.sheet}</option>)}
              </select>
            </label>
            <label>
              <span>原文列</span>
              <select value={draft.sourceColumn} onChange={(event) => update({ sourceColumn: Number(event.target.value) })}>
                {columns.map((column) => <option key={column} value={column}>{columnName(column)} 列</option>)}
              </select>
            </label>
            <label>
              <span>译文列</span>
              <select value={draft.targetColumn ?? ''} onChange={(event) => update({ targetColumn: event.target.value === '' ? null : Number(event.target.value) })}>
                <option value="">没有译文列</option>
                {columns.map((column) => <option key={column} value={column}>{columnName(column)} 列</option>)}
              </select>
            </label>
            <label>
              <span>从第几行开始</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, selectedSheet.data.length)}
                value={draft.startRow}
                onChange={(event) => update({ startRow: Math.max(1, Number(event.target.value) || 1) })}
              />
            </label>
            <label>
              <span>原文语言</span>
              <select value={draft.sourceLanguage} onChange={(event) => update({ sourceLanguage: event.target.value })}>
                {languageOptions.map((language) => <option key={language}>{language}</option>)}
              </select>
            </label>
            <label>
              <span>目标语言</span>
              <select value={draft.targetLanguage} onChange={(event) => update({ targetLanguage: event.target.value })}>
                {languageOptions.map((language) => <option key={language}>{language}</option>)}
              </select>
            </label>
          </div>

          <label className="regex-field">
            <span>非译元素正则表达式</span>
            <textarea
              value={draft.nonTranslatablePattern}
              onChange={(event) => update({ nonTranslatablePattern: event.target.value })}
              placeholder="例如：<[^>]+>|%s|\\n"
              spellCheck={false}
            />
            {regexError ? <em className="field-error">{regexError}</em> : <small>导入时会记录命中的标签、变量和占位符，供后续标签保护与QA使用。</small>}
          </label>

          <div className="import-preview-heading">
            <strong>数据预览</strong>
            <span>将导入 {previewSegments.length} 个句段 · 命中 {protectedCount} 个非译元素</span>
          </div>
          <div className="import-preview-scroll">
            <table className="import-preview-table">
              <thead>
                <tr><th>#</th>{columns.map((column) => <th key={column}>{columnName(column)}</th>)}</tr>
              </thead>
              <tbody>
                {previewRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex + 1 < draft.startRow ? 'skipped-row' : ''}>
                    <th>{rowIndex + 1}</th>
                    {columns.map((column) => (
                      <td
                        key={column}
                        className={column === draft.sourceColumn ? 'source-column' : column === draft.targetColumn ? 'target-column' : ''}
                      >
                        {row[column] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="import-dialog-footer">
          <div><i className="source-key" />原文列 <i className="target-key" />译文列</div>
          <button className="secondary-button" onClick={onCancel}>取消</button>
          <button
            className="primary-button"
            onClick={onConfirm}
            disabled={Boolean(regexError) || !previewSegments.length || draft.sourceColumn === draft.targetColumn}
          >
            确认导入
          </button>
        </footer>
      </section>
    </div>
  )
}

function assetKindLabel(kind: AssetKind) {
  return kind === 'memory' ? '翻译记忆库' : '术语库'
}

function assetEntriesFromRows(rows: unknown[][], draft: AssetImportDraft) {
  const normalizedRows = normalizeRows(rows)
  return normalizedRows
    .map((row, rowIndex) => ({ row, rowIndex }))
    .filter(({ rowIndex }) => rowIndex >= draft.startRow - 1)
    .map(({ row }) => ({
      source: row[draft.sourceColumn]?.trim() ?? '',
      target: draft.targetColumn == null ? '' : row[draft.targetColumn]?.trim() ?? '',
    }))
    .filter((entry) => entry.source && entry.target)
}

function AssetImportDialog({
  draft,
  onChange,
  onCancel,
  onConfirm,
}: {
  draft: AssetImportDraft
  onChange: (next: AssetImportDraft) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const selectedSheet = draft.sheets.find((sheet) => sheet.sheet === draft.sheetName) ?? draft.sheets[0]
  const maxColumns = Math.max(1, ...selectedSheet.data.slice(0, 30).map((row) => row.length))
  const columns = Array.from({ length: maxColumns }, (_, index) => index)
  const previewRows = normalizeRows(selectedSheet.data).slice(0, 8)
  const entries = assetEntriesFromRows(selectedSheet.data, draft)
  const update = (changes: Partial<AssetImportDraft>) => onChange({ ...draft, ...changes })

  return (
    <div className="modal-backdrop">
      <section className="import-dialog asset-import-dialog" role="dialog" aria-modal="true" aria-label={`${assetKindLabel(draft.kind)}导入设置`}>
        <header className="import-dialog-header">
          <div>
            <span className="eyebrow">导入{assetKindLabel(draft.kind)}</span>
            <h2>{draft.assetName}</h2>
          </div>
          <button className="dialog-close" onClick={onCancel} aria-label="关闭资产导入设置">×</button>
        </header>

        <div className="import-dialog-body">
          <div className="import-settings-grid">
            <label>
              <span>资产名称</span>
              <input value={draft.assetName} onChange={(event) => update({ assetName: event.target.value })} />
            </label>
            <label>
              <span>工作表</span>
              <select value={draft.sheetName} onChange={(event) => update({ sheetName: event.target.value })}>
                {draft.sheets.map((sheet) => <option key={sheet.sheet} value={sheet.sheet}>{sheet.sheet}</option>)}
              </select>
            </label>
            <label>
              <span>从第几行开始</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, selectedSheet.data.length)}
                value={draft.startRow}
                onChange={(event) => update({ startRow: Math.max(1, Number(event.target.value) || 1) })}
              />
            </label>
            <label>
              <span>原文列</span>
              <select value={draft.sourceColumn} onChange={(event) => update({ sourceColumn: Number(event.target.value) })}>
                {columns.map((column) => <option key={column} value={column}>{columnName(column)} 列</option>)}
              </select>
            </label>
            <label>
              <span>译文列</span>
              <select value={draft.targetColumn ?? ''} onChange={(event) => update({ targetColumn: event.target.value === '' ? null : Number(event.target.value) })}>
                <option value="">没有译文列</option>
                {columns.map((column) => <option key={column} value={column}>{columnName(column)} 列</option>)}
              </select>
            </label>
            <label>
              <span>{draft.kind === 'terms' ? '资产状态' : '记录类型'}</span>
              {draft.kind === 'terms' ? (
                <select value={draft.status} onChange={(event) => update({ status: event.target.value as TermEntry['status'] })}>
                  <option value="approved">导入为已批准</option>
                  <option value="draft">导入为草稿</option>
                </select>
              ) : <input value="原文 — 译文" readOnly />}
            </label>
            <label>
              <span>原文语言</span>
              <select value={draft.sourceLanguage} onChange={(event) => update({ sourceLanguage: event.target.value })}>
                {languageOptions.map((language) => <option key={language}>{language}</option>)}
              </select>
            </label>
            <label>
              <span>目标语言</span>
              <select value={draft.targetLanguage} onChange={(event) => update({ targetLanguage: event.target.value })}>
                {languageOptions.map((language) => <option key={language}>{language}</option>)}
              </select>
            </label>
          </div>

          <div className="asset-import-hint">
            <Cloud size={15} />
            <span>{assetKindLabel(draft.kind)}会保存在本机，并参与当前语言对的匹配。重复的原文/术语会在导入时自动合并。</span>
          </div>

          <div className="import-preview-heading">
            <strong>数据预览</strong>
            <span>将导入 {entries.length} 条资产</span>
          </div>
          <div className="import-preview-scroll">
            <table className="import-preview-table asset-preview-table">
              <thead><tr><th>#</th><th>原文</th><th>译文</th></tr></thead>
              <tbody>
                {previewRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex + 1 < draft.startRow ? 'skipped-row' : ''}>
                    <th>{rowIndex + 1}</th>
                    <td className={draft.sourceColumn === 0 ? 'source-column' : ''}>{row[draft.sourceColumn] ?? ''}</td>
                    <td className={draft.targetColumn === 1 ? 'target-column' : ''}>{draft.targetColumn == null ? '' : row[draft.targetColumn] ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="import-dialog-footer">
          <div><i className="source-key" />原文列 <i className="target-key" />译文列</div>
          <button className="secondary-button" onClick={onCancel}>取消</button>
          <button
            className="primary-button"
            onClick={onConfirm}
            disabled={!draft.assetName.trim() || !entries.length || draft.targetColumn == null || draft.sourceColumn === draft.targetColumn}
          >
            导入 {entries.length} 条资产
          </button>
        </footer>
      </section>
    </div>
  )
}

function AssetManagerDialog({
  kind,
  assets,
  onClose,
  onImport,
  onDelete,
}: {
  kind: AssetKind
  assets: AssetRecord[]
  onClose: () => void
  onImport: () => void
  onDelete: (asset: AssetRecord) => void
}) {
  const currentAssets = assets.filter((asset) => asset.kind === kind)
  const totalEntries = currentAssets.reduce((total, asset) => total + asset.entryCount, 0)

  return (
    <div className="modal-backdrop">
      <section className="asset-manager-dialog" role="dialog" aria-modal="true" aria-label={assetKindLabel(kind)}>
        <header className="import-dialog-header">
          <div>
            <span className="eyebrow">本地翻译资产</span>
            <h2>{assetKindLabel(kind)}</h2>
          </div>
          <button className="dialog-close" onClick={onClose} aria-label="关闭资产管理">×</button>
        </header>
        <div className="asset-manager-body">
          <div className="asset-manager-summary">
            <div><strong>{currentAssets.length}</strong><span>个资产文件</span></div>
            <div><strong>{totalEntries}</strong><span>条可用记录</span></div>
            <button className="primary-button" onClick={onImport}><Upload size={15} />导入文件</button>
          </div>
          {currentAssets.length ? currentAssets.map((asset) => (
            <div className="asset-file-card" key={asset.id}>
              <div className={`asset-file-icon ${kind}`}>{kind === 'memory' ? <Cloud size={17} /> : <BookOpen size={17} />}</div>
              <div className="asset-file-info">
                <strong>{asset.name}</strong>
                <span>{asset.entryCount} 条记录 · {asset.sourceLanguage} → {asset.targetLanguage} · {asset.updatedAt}</span>
              </div>
              <button className="asset-delete-button" onClick={() => onDelete(asset)} title="移除资产" aria-label={`移除${asset.name}`}><Trash2 size={15} /></button>
            </div>
          )) : (
            <div className="asset-manager-empty">{kind === 'memory' ? <Cloud size={26} /> : <BookOpen size={26} />}<strong>还没有导入{assetKindLabel(kind)}</strong><span>导入 Excel、CSV 或 TSV 后，当前原文会实时获得资产匹配。</span></div>
          )}
        </div>
        <footer className="asset-manager-footer">
          <span>资产只保存在本机，不会自动上传到外部服务。</span>
          <button className="secondary-button" onClick={onClose}>完成</button>
        </footer>
      </section>
    </div>
  )
}

function App() {
  const [files, setFiles] = useState<ProjectFile[]>(projectFiles)
  const [segmentsByFile, setSegmentsByFile] = useState<Record<string, Segment[]>>(cloneInitialSegments)
  const [activeFileId, setActiveFileId] = useState(projectFiles[0].id)
  const [activeSegmentId, setActiveSegmentId] = useState(4)
  const [filter, setFilter] = useState<FilterType>('all')
  const [query, setQuery] = useState('')
  const [isInspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('suggestions')
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const [notice, setNotice] = useState<string | null>(null)
  const [isImporting, setImporting] = useState(false)
  const [isExporting, setExporting] = useState(false)
  const [importDraft, setImportDraft] = useState<ImportDraft | null>(null)
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [activeAssetKind, setActiveAssetKind] = useState<AssetKind | null>(null)
  const [assetDraft, setAssetDraft] = useState<AssetImportDraft | null>(null)
  const [isAssetImporting, setAssetImporting] = useState(false)
  const saveTimer = useRef<number | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const assetFileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0]
  const segments = segmentsByFile[activeFileId] ?? []

  const showNotice = (message: string) => {
    setNotice(message)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2800)
  }

  useEffect(() => {
    void loadAssetRecords().then(setAssets).catch(() => showNotice('本地资产加载失败，请重新启动应用。'))
    void loadFileRecords().then(async (records) => {
      if (records.length) {
        const migratedRecords = records.map((record) => {
          const pattern = record.file.importSettings?.nonTranslatablePattern ?? DEFAULT_NON_TRANSLATABLE_PATTERN
          const migratedSegments = record.segments.map((segment) => (
            segment.protectedElements == null
              ? { ...segment, protectedElements: extractProtectedElements(segment.source, pattern) }
              : segment
          ))
          return { ...record, segments: migratedSegments }
        })
        setFiles(migratedRecords.map((record) => record.file))
        setSegmentsByFile(Object.fromEntries(migratedRecords.map((record) => [record.id, record.segments])))
        setActiveFileId(migratedRecords[0].id)
        setActiveSegmentId(migratedRecords[0].segments[0]?.id ?? 1)
        await Promise.all(migratedRecords.map((record) => saveFileRecord(record.file, record.segments, record.originalFile)))
        return
      }

      await Promise.all(
        projectFiles.map((file) => saveFileRecord(file, initialSegmentsByFile[file.id] ?? [])),
      )
    }).catch(() => showNotice('本地数据初始化失败，请重新启动应用。'))
  }, [])

  useEffect(() => {
    const currentSegments = segmentsByFile[activeFileId] ?? []
    if (!currentSegments.some((segment) => segment.id === activeSegmentId)) {
      setActiveSegmentId(currentSegments[0]?.id ?? 1)
    }
  }, [activeFileId, activeSegmentId, segmentsByFile])

  const filteredSegments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return segments.filter((segment) => {
      const matchesFilter = filter === 'all' || segment.status === filter
      const matchesQuery =
        !normalizedQuery ||
        segment.source.toLowerCase().includes(normalizedQuery) ||
        segment.target.toLowerCase().includes(normalizedQuery)
      return matchesFilter && matchesQuery
    })
  }, [filter, query, segments])

  const counts = useMemo(() => {
    const translated = segments.filter((item) => item.status === 'translated').length
    const review = segments.filter((item) => item.status === 'review').length
    return {
      translated,
      review,
      untranslated: segments.length - translated - review,
      progress: getProgress(segments),
    }
  }, [segments])

  const projectCounts = useMemo(() => {
    const allSegments = Object.values(segmentsByFile).flat()
    return {
      total: allSegments.length,
      completed: allSegments.filter((segment) => segment.status !== 'untranslated').length,
      progress: getProgress(allSegments),
    }
  }, [segmentsByFile])

  const activeSegment = segments.find((segment) => segment.id === activeSegmentId) ?? segments[0]

  const translationMemory = useMemo<TranslationMemoryEntry[]>(() => {
    const liveEntries = Object.entries(segmentsByFile).flatMap(([fileId, fileSegments]) => {
      const file = files.find((candidate) => candidate.id === fileId)
      return fileSegments
        .filter((segment) => segment.target.trim() && segment.status === 'translated')
        .map((segment) => ({
          id: `live-${fileId}-${segment.id}`,
          source: segment.source,
          target: segment.target,
          project: file?.name ?? '当前项目',
          fileId,
          segmentId: segment.id,
        }))
    })
    const importedEntries = assets
      .filter((asset) => asset.kind === 'memory' && asset.sourceLanguage === activeFile?.sourceLanguage && asset.targetLanguage === activeFile?.targetLanguage)
      .flatMap((asset) => (asset.entries as TranslationMemoryEntry[]).map((entry, index) => ({
        ...entry,
        id: `asset-${asset.id}-${index}`,
        project: entry.project || asset.name,
      })))
    return [...importedEntries, ...liveEntries, ...seedTranslationMemory]
  }, [activeFile?.sourceLanguage, activeFile?.targetLanguage, assets, files, segmentsByFile])

  const memoryMatches = useMemo(() => {
    if (!activeSegment) return []
    const deduplicated = new Map<string, TranslationMemoryEntry & { score: number }>()
    for (const entry of translationMemory) {
      if (entry.fileId === activeFileId && entry.segmentId === activeSegment.id) continue
      const score = similarityScore(activeSegment.source, entry.source)
      if (score < 45) continue
      const key = `${entry.source}\u0000${entry.target}`
      const existing = deduplicated.get(key)
      if (!existing || score > existing.score) deduplicated.set(key, { ...entry, score })
    }
    return [...deduplicated.values()].sort((left, right) => right.score - left.score).slice(0, 3)
  }, [activeFileId, activeSegment, translationMemory])

  const termMatches = useMemo(() => {
    if (!activeSegment) return []
    const importedTerms = assets
      .filter((asset) => asset.kind === 'terms' && asset.sourceLanguage === activeFile?.sourceLanguage && asset.targetLanguage === activeFile?.targetLanguage)
      .flatMap((asset) => asset.entries as TermEntry[])
    const deduplicated = new Map<string, TermEntry>()
    for (const term of [...importedTerms, ...seedTerms]) {
      if (!activeSegment.source.includes(term.source)) continue
      const key = `${term.source}\u0000${term.target}`
      if (!deduplicated.has(key)) deduplicated.set(key, term)
    }
    return [...deduplicated.values()].sort((left, right) => right.source.length - left.source.length)
  }, [activeFile?.sourceLanguage, activeFile?.targetLanguage, activeSegment, assets])

  const activeMissingElements = activeSegment ? getMissingProtectedElements(activeSegment) : []

  const persistSegments = (file: ProjectFile, nextSegments: Segment[]) => {
    setSaveState('saving')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void saveFileRecord(file, nextSegments)
        .then(() => setSaveState('saved'))
        .catch(() => showNotice('自动保存失败，请使用 Ctrl+S 重试。'))
    }, 450)
  }

  const replaceSegments = (nextSegments: Segment[]) => {
    setSegmentsByFile((current) => ({ ...current, [activeFileId]: nextSegments }))
    persistSegments(activeFile, nextSegments)
  }

  const updateTarget = (id: number, target: string) => {
    const nextSegments = segments.map((segment) =>
      segment.id === id
        ? {
            ...segment,
            target,
            status: target.trim() ? 'review' : 'untranslated' as SegmentStatus,
          }
        : segment,
    )
    replaceSegments(nextSegments)
  }

  const setSegmentStatus = (id: number, status: SegmentStatus) => {
    replaceSegments(segments.map((segment) => (segment.id === id ? { ...segment, status } : segment)))
  }

  const applySuggestion = (translation: string) => {
    if (!activeSegment) return
    updateTarget(activeSegment.id, translation)
    showNotice('翻译建议已填入当前句段。')
  }

  const confirmActiveSegment = () => {
    if (!activeSegment?.target.trim()) {
      showNotice('请先填写译文，再确认句段。')
      return
    }
    const missingElements = getMissingProtectedElements(activeSegment)
    if (missingElements.length) {
      setSegmentStatus(activeSegment.id, 'review')
      showNotice(`缺少非译元素：${missingElements.join('、')}`)
      return
    }
    setSegmentStatus(activeSegment.id, 'translated')
    showNotice('句段已确认。')
  }

  const selectFile = (fileId: string) => {
    setActiveFileId(fileId)
    setFilter('all')
    setQuery('')
    setInspectorTab('suggestions')
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''
    if (!selectedFile) return

    setImporting(true)
    try {
      const lowerName = selectedFile.name.toLowerCase()
      let sheets: ParsedSheet[]

      if (lowerName.endsWith('.xlsx')) {
        sheets = (await readXlsxFile(selectedFile)).map((sheet) => ({ sheet: sheet.sheet, data: sheet.data }))
      } else if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
        const text = await selectedFile.text()
        sheets = [{
          sheet: lowerName.endsWith('.tsv') ? 'TSV' : 'CSV',
          data: parseCsv(text, lowerName.endsWith('.tsv') ? '\t' : ','),
        }]
      } else {
        throw new Error('unsupported')
      }

      if (!sheets.length || !sheets[0].data.length) throw new Error('empty')
      const firstSheet = sheets[0]
      setImportDraft({
        file: selectedFile,
        originalFile: await selectedFile.arrayBuffer(),
        sheets,
        sheetName: firstSheet.sheet,
        sourceColumn: 0,
        targetColumn: 1,
        startRow: looksLikeHeader(firstSheet.data) ? 2 : 1,
        sourceLanguage: activeFile?.sourceLanguage ?? '简体中文',
        targetLanguage: activeFile?.targetLanguage ?? '越南语',
        nonTranslatablePattern: DEFAULT_NON_TRANSLATABLE_PATTERN,
      })
    } catch (error) {
      showNotice(error instanceof Error && error.message === 'unsupported'
        ? '当前支持 XLSX、CSV 和 TSV 文件。'
        : '没有读取到有效工作表，请检查文件内容。')
    } finally {
      setImporting(false)
    }
  }

  const confirmFileImport = async () => {
    if (!importDraft) return
    const selectedSheet = importDraft.sheets.find((sheet) => sheet.sheet === importDraft.sheetName) ?? importDraft.sheets[0]
    const settings: ImportSettings = {
      sheetName: importDraft.sheetName,
      sourceColumn: importDraft.sourceColumn,
      targetColumn: importDraft.targetColumn,
      startRow: importDraft.startRow,
      sourceLanguage: importDraft.sourceLanguage,
      targetLanguage: importDraft.targetLanguage,
      nonTranslatablePattern: importDraft.nonTranslatablePattern,
    }
    const importedSegments = rowsToSegments(selectedSheet.data, settings)
    if (!importedSegments.length) {
      showNotice('当前设置没有读取到原文，请检查原文列和起始行。')
      return
    }

    const importedFile: ProjectFile = {
      id: `imported-${Date.now()}`,
      name: importDraft.file.name,
      sourceLanguage: settings.sourceLanguage,
      targetLanguage: settings.targetLanguage,
      progress: getProgress(importedSegments),
      segmentCount: importedSegments.length,
      updatedAt: '刚刚',
      importSettings: settings,
    }

    setFiles((current) => [importedFile, ...current])
    setSegmentsByFile((current) => ({ ...current, [importedFile.id]: importedSegments }))
    setActiveFileId(importedFile.id)
    setActiveSegmentId(importedSegments[0].id)
    setFilter('all')
    setQuery('')
    await saveFileRecord(importedFile, importedSegments, importDraft.originalFile)
    setImportDraft(null)
    showNotice(`已导入 ${importedSegments.length} 个句段。`)
  }

  const openAssetManager = (kind: AssetKind) => {
    setActiveAssetKind(kind)
    setAssetDraft(null)
  }

  const handleAssetImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''
    if (!selectedFile || !activeAssetKind) return

    setAssetImporting(true)
    try {
      const lowerName = selectedFile.name.toLowerCase()
      let sheets: ParsedSheet[]
      if (lowerName.endsWith('.xlsx')) {
        sheets = (await readXlsxFile(selectedFile)).map((sheet) => ({ sheet: sheet.sheet, data: sheet.data }))
      } else if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
        const text = await selectedFile.text()
        sheets = [{
          sheet: lowerName.endsWith('.tsv') ? 'TSV' : 'CSV',
          data: parseCsv(text, lowerName.endsWith('.tsv') ? '\t' : ','),
        }]
      } else {
        throw new Error('unsupported')
      }
      if (!sheets.length || !sheets[0].data.length) throw new Error('empty')

      const firstSheet = sheets[0]
      const basename = selectedFile.name.replace(/\.[^.]+$/, '')
      setAssetDraft({
        file: selectedFile,
        kind: activeAssetKind,
        assetName: basename,
        sheets,
        sheetName: firstSheet.sheet,
        sourceColumn: 0,
        targetColumn: 1,
        startRow: looksLikeHeader(firstSheet.data) ? 2 : 1,
        sourceLanguage: activeFile?.sourceLanguage ?? '简体中文',
        targetLanguage: activeFile?.targetLanguage ?? '越南语',
        status: 'approved',
      })
    } catch (error) {
      showNotice(error instanceof Error && error.message === 'unsupported'
        ? '资产文件支持 XLSX、CSV 和 TSV。'
        : '没有读取到有效资产表，请检查文件内容。')
    } finally {
      setAssetImporting(false)
    }
  }

  const confirmAssetImport = async () => {
    if (!assetDraft || assetDraft.targetColumn == null) return
    const selectedSheet = assetDraft.sheets.find((sheet) => sheet.sheet === assetDraft.sheetName) ?? assetDraft.sheets[0]
    const sourceRows = assetEntriesFromRows(selectedSheet.data, assetDraft)
    const uniqueEntries = new Map<string, { source: string; target: string }>()
    for (const entry of sourceRows) uniqueEntries.set(`${entry.source}\u0000${entry.target}`, entry)
    const entries = [...uniqueEntries.values()]
    if (!entries.length) {
      showNotice('当前设置没有读取到有效的原文/译文对应关系。')
      return
    }

    const assetId = `asset-${Date.now()}`
    const assetEntries = assetDraft.kind === 'memory'
      ? entries.map((entry, index): TranslationMemoryEntry => ({
          id: `${assetId}-${index}`,
          source: entry.source,
          target: entry.target,
          project: assetDraft.assetName,
        }))
      : entries.map((entry): TermEntry => ({
          source: entry.source,
          target: entry.target,
          status: assetDraft.status,
        }))
    const asset: AssetRecord = {
      id: assetId,
      kind: assetDraft.kind,
      name: assetDraft.assetName.trim(),
      sourceLanguage: assetDraft.sourceLanguage,
      targetLanguage: assetDraft.targetLanguage,
      updatedAt: '刚刚',
      entryCount: assetEntries.length,
      entries: assetEntries,
    }

    try {
      await saveAssetRecord(asset)
      setAssets((current) => [asset, ...current])
      setAssetDraft(null)
      showNotice(`已导入 ${asset.entryCount} 条${assetKindLabel(asset.kind)}记录。`)
    } catch {
      showNotice('资产保存失败，请稍后重试。')
    }
  }

  const removeAsset = async (asset: AssetRecord) => {
    if (!window.confirm(`确定移除“${asset.name}”吗？这不会删除原始文件。`)) return
    try {
      await deleteAssetRecord(asset.id)
      setAssets((current) => current.filter((candidate) => candidate.id !== asset.id))
      showNotice(`已移除${assetKindLabel(asset.kind)}“${asset.name}”。`)
    } catch {
      showNotice('移除资产失败，请稍后重试。')
    }
  }

  const exportActiveFile = async () => {
    if (!activeFile?.importSettings) {
      showNotice('示例文件没有原始文件，请先导入真实翻译文件。')
      return
    }

    setExporting(true)
    try {
      await saveFileRecord(activeFile, segments)
      const record = await loadFileRecord(activeFile.id)
      if (!record?.originalFile) throw new Error('missing-original-file')

      const exported = buildTranslatedExport(
        record.originalFile,
        activeFile.name,
        activeFile.importSettings,
        segments,
      )
      const basename = activeFile.name.replace(/\.[^.]+$/, '')
      const defaultName = `${basename}_已翻译.${exported.extension}`
      const filters = [{
        name: exported.extension.toUpperCase(),
        extensions: [exported.extension],
      }]

      if (window.catApp?.saveExportedFile) {
        const result = await window.catApp.saveExportedFile({
          defaultName,
          data: exported.bytes,
          filters,
        })
        if (result.canceled) {
          showNotice('已取消导出。')
          return
        }
      } else {
        const blob = new Blob([exported.bytes as BlobPart], { type: exported.mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = defaultName
        link.click()
        URL.revokeObjectURL(url)
      }

      const qaWarnings = segments.filter((segment) => getMissingProtectedElements(segment).length > 0).length
      const targetColumnLabel = `${columnName(exported.targetColumn)} 列`
      showNotice(qaWarnings
        ? `导出完成，译文已写入 ${targetColumnLabel}；另有 ${qaWarnings} 个句段存在非译元素警告。`
        : `导出完成，译文已写入 ${targetColumnLabel}。`)
    } catch (error) {
      showNotice(error instanceof Error && error.message === 'missing-original-file'
        ? '找不到导入时保存的原始文件，请重新导入。'
        : '导出失败，原文件可能已损坏或格式暂不受支持。')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        setSaveState('saving')
        void saveFileRecord(activeFile, segments)
          .then(() => setSaveState('saved'))
          .catch(() => showNotice('保存失败，请稍后重试。'))
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && activeSegment) {
        event.preventDefault()
        confirmActiveSegment()
      }
    }

    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [activeFile, activeSegment, segments])

  return (
    <div className="app-shell">
      <div className="window-dragbar" aria-hidden="true" />
      {notice && <div className="toast-message"><Check size={15} />{notice}</div>}
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        accept=".xlsx,.csv,.tsv"
        onChange={handleFileImport}
      />
      <input
        ref={assetFileInputRef}
        className="hidden-file-input"
        type="file"
        accept=".xlsx,.csv,.tsv"
        onChange={handleAssetImport}
      />
      {importDraft && (
        <ImportDialog
          draft={importDraft}
          onChange={setImportDraft}
          onCancel={() => setImportDraft(null)}
          onConfirm={() => void confirmFileImport()}
        />
      )}
      {activeAssetKind && !assetDraft && (
        <AssetManagerDialog
          kind={activeAssetKind}
          assets={assets}
          onClose={() => setActiveAssetKind(null)}
          onImport={() => assetFileInputRef.current?.click()}
          onDelete={(asset) => void removeAsset(asset)}
        />
      )}
      {assetDraft && (
        <AssetImportDialog
          draft={assetDraft}
          onChange={setAssetDraft}
          onCancel={() => setAssetDraft(null)}
          onConfirm={() => void confirmAssetImport()}
        />
      )}

      <aside className="app-rail">
        <div className="brand-mark" aria-label="LingoForge">
          <Languages size={22} strokeWidth={2.2} />
        </div>
        <nav className="rail-nav">
          <button className={`rail-button ${!activeAssetKind ? 'active' : ''}`} title="项目" onClick={() => setActiveAssetKind(null)}><FolderKanban size={20} /></button>
          <button className={`rail-button ${activeAssetKind === 'memory' ? 'active' : ''}`} title="翻译记忆库" onClick={() => openAssetManager('memory')}><Cloud size={20} /></button>
          <button className={`rail-button ${activeAssetKind === 'terms' ? 'active' : ''}`} title="术语库" onClick={() => openAssetManager('terms')}><BookOpen size={20} /></button>
          <button className="rail-button upcoming" title="质量检查将在下一阶段开放" disabled><AlertCircle size={20} /></button>
        </nav>
        <div className="rail-bottom">
          <button className="rail-button upcoming" title="帮助文档正在建设" disabled><CircleHelp size={20} /></button>
          <button className="rail-button upcoming" title="设置将在接入AI时开放" disabled><Settings size={20} /></button>
          <div className="avatar">LJ</div>
        </div>
      </aside>

      <aside className="project-sidebar">
        <div className="sidebar-heading drag-region">
          <div>
            <span className="eyebrow">当前项目</span>
            <button className="project-switcher no-drag" disabled title="多项目管理将在后续版本开放">
              无名 · 越南语 <ChevronDown size={15} />
            </button>
          </div>
          <button className="icon-button no-drag" disabled title="项目菜单将在后续版本开放"><MoreHorizontal size={19} /></button>
        </div>

        <div className="project-progress">
          <div className="progress-copy">
            <span>项目进度</span>
            <strong>{projectCounts.progress}%</strong>
          </div>
          <div className="progress-track"><span style={{ width: `${projectCounts.progress}%` }} /></div>
          <div className="progress-meta">{projectCounts.completed} / {projectCounts.total} 个句段</div>
        </div>

        <div className="file-section-heading">
          <span><Files size={15} /> 文件</span>
          <button className="mini-icon-button" title="导入文件" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <FilePlus2 size={16} />
          </button>
        </div>

        <div className="file-list">
          {files.map((file) => {
            const fileSegments = segmentsByFile[file.id] ?? []
            const fileProgress = getProgress(fileSegments)
            return (
              <button
                className={`file-card ${file.id === activeFileId ? 'active' : ''}`}
                key={file.id}
                onClick={() => selectFile(file.id)}
              >
                <div className="file-type">{file.name.split('.').pop()?.slice(0, 4).toUpperCase() ?? 'FILE'}</div>
                <div className="file-info">
                  <strong>{file.name}</strong>
                  <span>{fileSegments.length} 个句段 · {file.updatedAt}</span>
                  <div className="file-progress"><span style={{ width: `${fileProgress}%` }} /></div>
                </div>
                <span className="file-percent">{fileProgress}%</span>
              </button>
            )
          })}
        </div>

        <button className="import-button" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
          <Upload size={16} /> {isImporting ? '正在导入…' : '导入翻译文件'}
        </button>
      </aside>

      <main className="workspace">
        <header className="workspace-header drag-region">
          <div className="document-title no-drag">
            <div className="doc-icon">{activeFile?.name.split('.').pop()?.[0]?.toUpperCase() ?? 'F'}</div>
            <div>
              <h1>{activeFile?.name ?? '未选择文件'}</h1>
              <p>{activeFile?.sourceLanguage ?? '简体中文'} <span>→</span> {activeFile?.targetLanguage ?? '越南语'}</p>
            </div>
          </div>
          <div className="header-actions no-drag">
            <div className={`save-indicator ${saveState}`}>
              {saveState === 'saved' ? <Check size={14} /> : <span className="saving-dot" />}
              {saveState === 'saved' ? '已自动保存' : '正在保存'}
            </div>
            <button
              className="secondary-button"
              onClick={() => void exportActiveFile()}
              disabled={isExporting || !activeFile?.importSettings}
              title={activeFile?.importSettings ? '按导入时的行列设置回写译文' : '示例文件没有可回写的原始文件'}
            >
              <Download size={16} /> {isExporting ? '正在导出…' : '导出文件'}
            </button>
            <button className="secondary-button disabled-action" disabled title="配置AI接口后开放">
              <Sparkles size={16} /> AI预翻译
            </button>
            <button className="primary-button disabled-action" disabled title="配置AI接口后开放">
              <Play size={15} fill="currentColor" /> 运行翻译
            </button>
          </div>
        </header>

        <section className="toolbar">
          <div className="search-box">
            <Search size={16} />
            <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索原文或译文…" />
            <kbd>Ctrl K</kbd>
          </div>
          <div className="filter-group">
            {([
              ['all', '全部', segments.length],
              ['untranslated', '未翻译', counts.untranslated],
              ['review', '待检查', counts.review],
              ['translated', '已翻译', counts.translated],
            ] as const).map(([value, label, count]) => (
              <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
                {label} <span>{count}</span>
              </button>
            ))}
          </div>
          <button className="toolbar-button disabled-action" disabled title="高级筛选将在后续版本开放"><Filter size={15} /> 高级筛选</button>
          <button className="toolbar-button" onClick={() => setInspectorOpen((open) => !open)}>
            <PanelRightClose size={16} /> {isInspectorOpen ? '收起面板' : '显示面板'}
          </button>
        </section>

        <section className={`editor-layout ${isInspectorOpen ? '' : 'inspector-hidden'}`}>
          <div className="segment-table">
            <div className="table-head">
              <div className="head-number">#</div>
              <div>原文 · {activeFile?.sourceLanguage ?? '简体中文'}</div>
              <div>译文 · {activeFile?.targetLanguage ?? '越南语'}</div>
              <div className="head-status">状态</div>
            </div>
            <div className="segment-scroll">
              {filteredSegments.map((segment) => {
                const missingElements = getMissingProtectedElements(segment)
                return (
                <div
                  className={`segment-row ${segment.id === activeSegmentId ? 'active' : ''}`}
                  key={segment.id}
                  onClick={() => setActiveSegmentId(segment.id)}
                >
                  <div className="segment-number">
                    <span>{segment.id}</span>
                    <i className={`status-dot ${segment.status}`} />
                  </div>
                  <div className="source-cell">
                    <p>{segment.source}</p>
                    {segment.note && <span className="inline-note"><AlertCircle size={13} /> {segment.note}</span>}
                    {missingElements.length > 0 && (
                      <span className="inline-note qa-error"><AlertCircle size={13} /> 缺少非译元素：{missingElements.join('、')}</span>
                    )}
                  </div>
                  <div className="target-cell">
                    <textarea
                      value={segment.target}
                      onChange={(event) => updateTarget(segment.id, event.target.value)}
                      onFocus={() => setActiveSegmentId(segment.id)}
                      placeholder="输入译文，或使用翻译记忆库生成…"
                      spellCheck={false}
                    />
                  </div>
                  <div className="status-cell">
                    <button
                      className={`status-chip ${segment.status}`}
                      title="点击切换状态"
                      onClick={(event) => {
                        event.stopPropagation()
                        if (!segment.target.trim()) {
                          showNotice('空译文不能标记为已翻译。')
                          return
                        }
                        if (segment.status !== 'translated' && missingElements.length) {
                          showNotice(`缺少非译元素：${missingElements.join('、')}`)
                          setSegmentStatus(segment.id, 'review')
                          return
                        }
                        setSegmentStatus(segment.id, segment.status === 'translated' ? 'review' : 'translated')
                      }}
                    >
                      {statusLabel[segment.status]}
                    </button>
                    {segment.match && <span className="match-score">{segment.match}%</span>}
                  </div>
                </div>
                )
              })}
              {filteredSegments.length === 0 && (
                <div className="empty-state"><Search size={28} /><strong>没有找到匹配句段</strong><span>请更换搜索词或筛选条件</span></div>
              )}
            </div>
          </div>

          {isInspectorOpen && activeSegment && (
            <aside className="inspector">
              <div className="inspector-tabs">
                <button className={inspectorTab === 'suggestions' ? 'active' : ''} onClick={() => setInspectorTab('suggestions')}>
                  <Sparkles size={15} /> 建议
                </button>
                <button className={inspectorTab === 'ai' ? 'active' : ''} onClick={() => setInspectorTab('ai')}>
                  <Bot size={15} /> AI
                </button>
                <button className={inspectorTab === 'terms' ? 'active' : ''} onClick={() => setInspectorTab('terms')}>
                  <BookOpen size={15} /> 术语
                </button>
              </div>

              <div className="inspector-content">
                <div className="context-card">
                  <div className="card-title"><span>当前句段</span><strong>#{activeSegment.id}</strong></div>
                  <p>{activeSegment.source}</p>
                  {activeSegment.protectedElements?.length ? (
                    <div className="protected-elements">
                      {activeSegment.protectedElements.map((element, index) => <code key={`${element}-${index}`}>{element}</code>)}
                    </div>
                  ) : null}
                  {activeMissingElements.length ? (
                    <div className="warning-box qa-warning"><AlertCircle size={15} />译文缺少：{activeMissingElements.join('、')}</div>
                  ) : null}
                  {activeSegment.note && <div className="warning-box"><AlertCircle size={15} />{activeSegment.note}</div>}
                </div>

                {inspectorTab === 'suggestions' && (
                  <>
                    <div className="suggestion-section">
                      <div className="section-title"><span>翻译记忆库</span><em>点击即可采用</em></div>
                      {memoryMatches.length ? memoryMatches.map((match) => (
                        <button className="suggestion-card" key={match.id} onClick={() => applySuggestion(match.target)}>
                          <div><span className={`score ${match.score >= 90 ? 'high' : ''}`}>{match.score}%</span><small>{match.project}</small></div>
                          <p>{match.target}</p>
                          <span className="suggestion-source">{match.source}</span>
                        </button>
                      )) : (
                        <div className="asset-empty"><Cloud size={19} /><span>当前句段没有达到45%的记忆库匹配</span></div>
                      )}
                    </div>

                    <div className="suggestion-section">
                      <div className="section-title"><span>命中术语</span><em>{termMatches.length} 条</em></div>
                      {termMatches.length ? termMatches.map((term) => (
                        <div className="term-row" key={term.source}>
                          <strong>{term.source}</strong><span>{term.target}</span><i>{term.status === 'approved' ? '已批准' : '草稿'}</i>
                        </div>
                      )) : (
                        <div className="asset-empty compact"><BookOpen size={17} /><span>当前原文没有命中术语</span></div>
                      )}
                    </div>
                  </>
                )}

                {inspectorTab === 'ai' && (
                  <div className="feature-panel">
                    <Bot size={24} />
                    <strong>AI接口尚未配置</strong>
                    <p>接入模型供应商、API Key和项目提示词后，这里将提供上下文翻译和改写。</p>
                    <span>下一阶段开发</span>
                  </div>
                )}

                {inspectorTab === 'terms' && (
                  <div className="suggestion-section">
                    <div className="section-title"><span>当前句段术语</span><em>{termMatches.length} 条</em></div>
                    {termMatches.length ? termMatches.map((term) => (
                      <div className="term-row" key={term.source}>
                        <strong>{term.source}</strong><span>{term.target}</span><i>{term.status === 'approved' ? '已批准' : '草稿'}</i>
                      </div>
                    )) : <div className="asset-empty"><BookOpen size={19} /><span>当前原文没有命中术语</span></div>}
                    <div className="feature-hint">{assets.filter((asset) => asset.kind === 'terms').length ? '当前已叠加本地导入术语库与内置示例术语。' : '当前使用内置示例术语；可从左侧术语库入口导入正式资产。'}</div>
                  </div>
                )}
              </div>

              <div className="inspector-footer">
                <button className="accept-button" onClick={confirmActiveSegment}>
                  <Check size={16} /> 确认句段 <kbd>Ctrl ↵</kbd>
                </button>
              </div>
            </aside>
          )}
        </section>

        <footer className="status-bar">
          <div><span className="status-dot translated" /> 已翻译 {counts.translated}</div>
          <div><span className="status-dot review" /> 待检查 {counts.review}</div>
          <div><span className="status-dot untranslated" /> 未翻译 {counts.untranslated}</div>
          <div className="status-spacer" />
          <div>进度 <strong>{counts.progress}%</strong></div>
          <div>第 {activeSegment?.id ?? 0} / {segments.length} 句</div>
        </footer>
      </main>
    </div>
  )
}

export default App

import { useEffect, useMemo, useRef, useState } from 'react'
import { readSheet } from 'read-excel-file/browser'
import {
  AlertCircle,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Cloud,
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
  Upload,
} from 'lucide-react'
import { initialSegmentsByFile, projectFiles } from './data'
import { loadFileRecords, saveFileRecord } from './storage'
import type { ProjectFile, Segment, SegmentStatus } from './types'

type FilterType = 'all' | SegmentStatus
type InspectorTab = 'suggestions' | 'ai' | 'terms'

const statusLabel: Record<SegmentStatus, string> = {
  untranslated: '未翻译',
  translated: '已翻译',
  review: '待检查',
}

const nextStatus: Record<SegmentStatus, SegmentStatus> = {
  untranslated: 'translated',
  translated: 'review',
  review: 'untranslated',
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

function rowsToSegments(rows: unknown[][]) {
  const normalizedRows = rows.map((row) => row.map((cell) => (cell == null ? '' : String(cell))))
  const firstRow = normalizedRows[0]?.map((value) => value.trim().toLowerCase()) ?? []
  const sourceHeaders = ['zh', 'source', 'source text', '原文', '中文', '简体中文']
  const targetHeaders = ['target', 'translation', '译文', '翻译', '越南语', 'vi', 'en', 'th', 'ko']
  const hasHeader = sourceHeaders.includes(firstRow[0]) || targetHeaders.includes(firstRow[1])
  const dataRows = hasHeader ? normalizedRows.slice(1) : normalizedRows

  return dataRows
    .filter((row) => row[0]?.trim())
    .map((row, index): Segment => {
      const source = row[0].trim()
      const target = row[1]?.trim() ?? ''
      return {
        id: index + 1,
        source,
        target,
        status: target ? 'translated' : 'untranslated',
      }
    })
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
  const saveTimer = useRef<number | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0]
  const segments = segmentsByFile[activeFileId] ?? []

  const showNotice = (message: string) => {
    setNotice(message)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2800)
  }

  useEffect(() => {
    void loadFileRecords().then(async (records) => {
      if (records.length) {
        setFiles(records.map((record) => record.file))
        setSegmentsByFile(Object.fromEntries(records.map((record) => [record.id, record.segments])))
        setActiveFileId(records[0].id)
        setActiveSegmentId(records[0].segments[0]?.id ?? 1)
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
        ? { ...segment, target, status: target.trim() ? 'translated' : 'untranslated' as SegmentStatus }
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
      let rows: unknown[][]

      if (lowerName.endsWith('.xlsx')) {
        rows = await readSheet(selectedFile)
      } else if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
        const text = await selectedFile.text()
        rows = parseCsv(text, lowerName.endsWith('.tsv') ? '\t' : ',')
      } else {
        throw new Error('unsupported')
      }

      const importedSegments = rowsToSegments(rows)
      if (!importedSegments.length) throw new Error('empty')

      const importedFile: ProjectFile = {
        id: `imported-${Date.now()}`,
        name: selectedFile.name,
        sourceLanguage: activeFile?.sourceLanguage ?? '简体中文',
        targetLanguage: activeFile?.targetLanguage ?? '越南语',
        progress: getProgress(importedSegments),
        segmentCount: importedSegments.length,
        updatedAt: '刚刚',
      }

      setFiles((current) => [importedFile, ...current])
      setSegmentsByFile((current) => ({ ...current, [importedFile.id]: importedSegments }))
      setActiveFileId(importedFile.id)
      setActiveSegmentId(importedSegments[0].id)
      setFilter('all')
      setQuery('')
      await saveFileRecord(importedFile, importedSegments)
      showNotice(`已导入 ${importedSegments.length} 个句段。`)
    } catch (error) {
      showNotice(error instanceof Error && error.message === 'unsupported'
        ? '当前支持 XLSX、CSV 和 TSV 文件。'
        : '未读取到有效原文，请确认原文在 A 列、译文在 B 列。')
    } finally {
      setImporting(false)
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
        setSegmentStatus(activeSegment.id, 'translated')
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

      <aside className="app-rail">
        <div className="brand-mark" aria-label="LingoForge">
          <Languages size={22} strokeWidth={2.2} />
        </div>
        <nav className="rail-nav">
          <button className="rail-button active" title="项目"><FolderKanban size={20} /></button>
          <button className="rail-button upcoming" title="翻译记忆库将在下一阶段开放" disabled><Cloud size={20} /></button>
          <button className="rail-button upcoming" title="术语库将在下一阶段开放" disabled><BookOpen size={20} /></button>
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
              {filteredSegments.map((segment) => (
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
                        setSegmentStatus(segment.id, nextStatus[segment.status])
                      }}
                    >
                      {statusLabel[segment.status]}
                    </button>
                    {segment.match && <span className="match-score">{segment.match}%</span>}
                  </div>
                </div>
              ))}
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
                  {activeSegment.note && <div className="warning-box"><AlertCircle size={15} />{activeSegment.note}</div>}
                </div>

                {inspectorTab === 'suggestions' && (
                  <>
                    <div className="suggestion-section">
                      <div className="section-title"><span>翻译记忆库</span><em>点击即可采用</em></div>
                      <button className="suggestion-card" onClick={() => applySuggestion('Chào mừng thiếu hiệp trở lại.')}>
                        <div><span className="score high">92%</span><small>无名 · 主线剧情</small></div>
                        <p>Chào mừng thiếu hiệp trở lại.</p>
                        <span className="suggestion-source">欢迎少侠归来。</span>
                      </button>
                      <button className="suggestion-card" onClick={() => applySuggestion('Một hành trình mới sắp bắt đầu.')}>
                        <div><span className="score">76%</span><small>奇迹3 · 系统文本</small></div>
                        <p>Một hành trình mới sắp bắt đầu.</p>
                        <span className="suggestion-source">新的旅程即将开始。</span>
                      </button>
                    </div>

                    <div className="suggestion-section">
                      <div className="section-title"><span>命中术语</span><em>示例数据</em></div>
                      <div className="term-row"><strong>少侠</strong><span>thiếu hiệp</span><i>已批准</i></div>
                      <div className="term-row"><strong>灵石</strong><span>Linh Thạch</span><i>已批准</i></div>
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
                    <div className="section-title"><span>当前句段术语</span><em>示例数据</em></div>
                    <div className="term-row"><strong>少侠</strong><span>thiếu hiệp</span><i>已批准</i></div>
                    <div className="term-row"><strong>灵石</strong><span>Linh Thạch</span><i>已批准</i></div>
                    <div className="feature-hint">术语库导入、编辑和项目绑定将在资产模块中实现。</div>
                  </div>
                )}
              </div>

              <div className="inspector-footer">
                <button className="accept-button" onClick={() => setSegmentStatus(activeSegment.id, 'translated')}>
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

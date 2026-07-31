import { useEffect, useMemo, useRef, useState } from 'react'
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
  LayoutGrid,
  MoreHorizontal,
  PanelRightClose,
  Play,
  Search,
  Settings,
  Sparkles,
  Upload,
} from 'lucide-react'
import { initialSegments, projectFiles } from './data'
import type { Segment, SegmentStatus } from './types'

type FilterType = 'all' | SegmentStatus

const statusLabel: Record<SegmentStatus, string> = {
  untranslated: '未翻译',
  translated: '已翻译',
  review: '待检查',
}

function loadSegments() {
  const stored = localStorage.getItem('lingoforge.demo.segments')
  if (!stored) return initialSegments
  try {
    return JSON.parse(stored) as Segment[]
  } catch {
    return initialSegments
  }
}

function App() {
  const [segments, setSegments] = useState<Segment[]>(loadSegments)
  const [activeSegmentId, setActiveSegmentId] = useState(4)
  const [filter, setFilter] = useState<FilterType>('all')
  const [query, setQuery] = useState('')
  const [isInspectorOpen, setInspectorOpen] = useState(true)
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const saveTimer = useRef<number | null>(null)

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
      progress: Math.round(((translated + review) / segments.length) * 100),
    }
  }, [segments])

  const activeSegment = segments.find((segment) => segment.id === activeSegmentId) ?? segments[0]

  useEffect(() => {
    const handleSave = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        localStorage.setItem('lingoforge.demo.segments', JSON.stringify(segments))
        setSaveState('saved')
      }
    }
    window.addEventListener('keydown', handleSave)
    return () => window.removeEventListener('keydown', handleSave)
  }, [segments])

  const updateTarget = (id: number, target: string) => {
    setSegments((current) =>
      current.map((segment) =>
        segment.id === id
          ? { ...segment, target, status: target.trim() ? 'translated' : 'untranslated' }
          : segment,
      ),
    )
    setSaveState('saving')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      setSegments((current) => {
        localStorage.setItem('lingoforge.demo.segments', JSON.stringify(current))
        return current
      })
      setSaveState('saved')
    }, 650)
  }

  const setSegmentStatus = (id: number, status: SegmentStatus) => {
    setSegments((current) => {
      const next = current.map((segment) => (segment.id === id ? { ...segment, status } : segment))
      localStorage.setItem('lingoforge.demo.segments', JSON.stringify(next))
      return next
    })
  }

  return (
    <div className="app-shell">
      <aside className="app-rail">
        <div className="brand-mark" aria-label="LingoForge">
          <Languages size={22} strokeWidth={2.2} />
        </div>
        <nav className="rail-nav">
          <button className="rail-button active" title="项目"><FolderKanban size={20} /></button>
          <button className="rail-button" title="翻译记忆库"><Cloud size={20} /></button>
          <button className="rail-button" title="术语库"><BookOpen size={20} /></button>
          <button className="rail-button" title="质量检查"><AlertCircle size={20} /></button>
        </nav>
        <div className="rail-bottom">
          <button className="rail-button" title="帮助"><CircleHelp size={20} /></button>
          <button className="rail-button" title="设置"><Settings size={20} /></button>
          <div className="avatar">LJ</div>
        </div>
      </aside>

      <aside className="project-sidebar">
        <div className="sidebar-heading drag-region">
          <div>
            <span className="eyebrow">当前项目</span>
            <button className="project-switcher no-drag">
              无名 · 越南语 <ChevronDown size={15} />
            </button>
          </div>
          <button className="icon-button no-drag"><MoreHorizontal size={19} /></button>
        </div>

        <div className="project-progress">
          <div className="progress-copy">
            <span>项目进度</span>
            <strong>67%</strong>
          </div>
          <div className="progress-track"><span style={{ width: '67%' }} /></div>
          <div className="progress-meta">548 / 818 个句段</div>
        </div>

        <div className="file-section-heading">
          <span><Files size={15} /> 文件</span>
          <button className="mini-icon-button" title="导入文件"><FilePlus2 size={16} /></button>
        </div>

        <div className="file-list">
          {projectFiles.map((file, index) => (
            <button className={`file-card ${index === 0 ? 'active' : ''}`} key={file.id}>
              <div className="file-type">XLSX</div>
              <div className="file-info">
                <strong>{file.name}</strong>
                <span>{file.segmentCount} 个句段 · {file.updatedAt}</span>
                <div className="file-progress"><span style={{ width: `${file.progress}%` }} /></div>
              </div>
              <span className="file-percent">{file.progress}%</span>
            </button>
          ))}
        </div>

        <button className="import-button"><Upload size={16} /> 导入翻译文件</button>
      </aside>

      <main className="workspace">
        <header className="workspace-header drag-region">
          <div className="document-title no-drag">
            <div className="doc-icon">X</div>
            <div>
              <h1>主线剧情.xlsx</h1>
              <p>简体中文 <span>→</span> 越南语</p>
            </div>
          </div>
          <div className="header-actions no-drag">
            <div className={`save-indicator ${saveState}`}>
              {saveState === 'saved' ? <Check size={14} /> : <span className="saving-dot" />}
              {saveState === 'saved' ? '已自动保存' : '正在保存'}
            </div>
            <button className="secondary-button"><Sparkles size={16} /> AI预翻译</button>
            <button className="primary-button"><Play size={15} fill="currentColor" /> 运行翻译</button>
          </div>
        </header>

        <section className="toolbar">
          <div className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索原文或译文…" />
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
          <button className="toolbar-button"><Filter size={15} /> 筛选</button>
          <button className="toolbar-button" onClick={() => setInspectorOpen((open) => !open)}>
            <PanelRightClose size={16} /> {isInspectorOpen ? '收起面板' : '显示面板'}
          </button>
        </section>

        <section className={`editor-layout ${isInspectorOpen ? '' : 'inspector-hidden'}`}>
          <div className="segment-table">
            <div className="table-head">
              <div className="head-number">#</div>
              <div>原文 · 简体中文</div>
              <div>译文 · 越南语</div>
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
                      placeholder="输入译文，或使用 AI / 翻译记忆库生成…"
                      spellCheck={false}
                    />
                  </div>
                  <div className="status-cell">
                    <button className={`status-chip ${segment.status}`} onClick={(event) => event.stopPropagation()}>
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

          {isInspectorOpen && (
            <aside className="inspector">
              <div className="inspector-tabs">
                <button className="active"><Sparkles size={15} /> 建议</button>
                <button><Bot size={15} /> AI</button>
                <button><BookOpen size={15} /> 术语</button>
              </div>

              <div className="inspector-content">
                <div className="context-card">
                  <div className="card-title"><span>当前句段</span><strong>#{activeSegment.id}</strong></div>
                  <p>{activeSegment.source}</p>
                  {activeSegment.note && <div className="warning-box"><AlertCircle size={15} />{activeSegment.note}</div>}
                </div>

                <div className="suggestion-section">
                  <div className="section-title"><span>翻译记忆库</span><button>查看全部</button></div>
                  <button className="suggestion-card">
                    <div><span className="score high">92%</span><small>无名 · 主线剧情</small></div>
                    <p>Chào mừng thiếu hiệp trở lại.</p>
                    <span className="suggestion-source">欢迎少侠归来。</span>
                  </button>
                  <button className="suggestion-card">
                    <div><span className="score">76%</span><small>奇迹3 · 系统文本</small></div>
                    <p>Một hành trình mới sắp bắt đầu.</p>
                    <span className="suggestion-source">新的旅程即将开始。</span>
                  </button>
                </div>

                <div className="suggestion-section">
                  <div className="section-title"><span>命中术语</span><button>管理术语库</button></div>
                  <div className="term-row"><strong>少侠</strong><span>thiếu hiệp</span><i>已批准</i></div>
                  <div className="term-row"><strong>灵石</strong><span>Linh Thạch</span><i>已批准</i></div>
                </div>
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
          <div>第 {activeSegment.id} / {segments.length} 句</div>
        </footer>
      </main>
    </div>
  )
}

export default App

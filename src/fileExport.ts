import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { ImportSettings, Segment } from './types'

export interface ExportedFile {
  bytes: Uint8Array
  extension: 'xlsx' | 'csv' | 'tsv'
  mimeType: string
  targetColumn: number
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

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? ''
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

function parseDelimited(text: string, delimiter: ',' | '\t') {
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
    } else if ((character === '\r' || character === '\n') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }

  row.push(cell)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  return rows
}

function serializeDelimited(rows: string[][], delimiter: ',' | '\t', lineEnding: string) {
  return rows.map((row) => row.map((cell) => {
    if (!cell.includes(delimiter) && !/["\r\n]/.test(cell)) return cell
    return `"${cell.replaceAll('"', '""')}"`
  }).join(delimiter)).join(lineEnding)
}

function resolvePartPath(basePath: string, target: string) {
  if (target.startsWith('/')) return target.slice(1)
  const parts = basePath.split('/')
  parts.pop()
  for (const part of target.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

function elementsByLocalName(parent: Document | Element, name: string) {
  return Array.from(parent.getElementsByTagNameNS('*', name))
}

function updateWorksheet(
  worksheetXml: string,
  settings: ImportSettings,
  segments: Segment[],
) {
  const parser = new DOMParser()
  const document = parser.parseFromString(worksheetXml, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('invalid-worksheet')

  const sheetData = elementsByLocalName(document, 'sheetData')[0]
  if (!sheetData) throw new Error('missing-sheet-data')

  const existingCells = elementsByLocalName(sheetData, 'c')
  const maxColumn = existingCells.reduce((max, cell) => {
    const reference = cell.getAttribute('r') ?? ''
    return Math.max(max, columnIndex(reference))
  }, -1)
  const targetColumn = settings.targetColumn ?? maxColumn + 1
  const worksheetNamespace = document.documentElement.namespaceURI

  const getRow = (rowNumber: number) => {
    const existingRow = elementsByLocalName(sheetData, 'row')
      .find((row) => Number(row.getAttribute('r')) === rowNumber)
    if (existingRow) return existingRow

    const row = document.createElementNS(worksheetNamespace, 'row')
    row.setAttribute('r', String(rowNumber))
    const nextRow = elementsByLocalName(sheetData, 'row')
      .find((candidate) => Number(candidate.getAttribute('r')) > rowNumber)
    sheetData.insertBefore(row, nextRow ?? null)
    return row
  }

  const setCellText = (rowNumber: number, target: string, copyStyleFromColumn?: number) => {
    const row = getRow(rowNumber)
    const reference = `${columnName(targetColumn)}${rowNumber}`
    let cell = Array.from(row.children).find((candidate) => candidate.localName === 'c' && candidate.getAttribute('r') === reference)

    if (!cell) {
      cell = document.createElementNS(worksheetNamespace, 'c')
      cell.setAttribute('r', reference)
      if (copyStyleFromColumn != null) {
        const styleSourceReference = `${columnName(copyStyleFromColumn)}${rowNumber}`
        const styleSource = Array.from(row.children)
          .find((candidate) => candidate.localName === 'c' && candidate.getAttribute('r') === styleSourceReference)
        const style = styleSource?.getAttribute('s')
        if (style) cell.setAttribute('s', style)
      }
      const nextCell = Array.from(row.children).find((candidate) => {
        if (candidate.localName !== 'c') return false
        return columnIndex(candidate.getAttribute('r') ?? '') > targetColumn
      })
      row.insertBefore(cell, nextCell ?? null)
    }

    while (cell.firstChild) cell.removeChild(cell.firstChild)
    cell.setAttribute('t', 'inlineStr')
    const inlineString = document.createElementNS(worksheetNamespace, 'is')
    const text = document.createElementNS(worksheetNamespace, 't')
    if (/^\s|\s$/.test(target)) text.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
    text.textContent = target
    inlineString.appendChild(text)
    cell.appendChild(inlineString)
  }

  for (const segment of segments) {
    if (!segment.sourceRow) continue
    setCellText(segment.sourceRow, segment.target, settings.sourceColumn)
  }

  if (settings.targetColumn == null && settings.startRow > 1) {
    setCellText(settings.startRow - 1, settings.targetLanguage, settings.sourceColumn)
  }

  const allReferences = elementsByLocalName(sheetData, 'c')
    .map((cell) => cell.getAttribute('r'))
    .filter((reference): reference is string => Boolean(reference))
  if (allReferences.length) {
    const coordinates = allReferences.map((reference) => {
      const row = Number(reference.match(/\d+$/)?.[0] ?? 1)
      return { column: columnIndex(reference), row }
    })
    const minColumn = Math.min(...coordinates.map((item) => item.column))
    const maxUsedColumn = Math.max(...coordinates.map((item) => item.column))
    const minRow = Math.min(...coordinates.map((item) => item.row))
    const maxRow = Math.max(...coordinates.map((item) => item.row))
    const dimension = elementsByLocalName(document, 'dimension')[0]
    dimension?.setAttribute('ref', `${columnName(minColumn)}${minRow}:${columnName(maxUsedColumn)}${maxRow}`)
  }

  return {
    xml: new XMLSerializer().serializeToString(document),
    targetColumn,
  }
}

function exportXlsx(originalFile: ArrayBuffer, settings: ImportSettings, segments: Segment[]): ExportedFile {
  const archive = unzipSync(new Uint8Array(originalFile))
  const workbookPath = 'xl/workbook.xml'
  const relationshipsPath = 'xl/_rels/workbook.xml.rels'
  const workbookBytes = archive[workbookPath]
  const relationshipBytes = archive[relationshipsPath]
  if (!workbookBytes || !relationshipBytes) throw new Error('invalid-xlsx')

  const parser = new DOMParser()
  const workbookDocument = parser.parseFromString(strFromU8(workbookBytes), 'application/xml')
  const sheet = elementsByLocalName(workbookDocument, 'sheet')
    .find((candidate) => candidate.getAttribute('name') === settings.sheetName)
  const relationshipId = sheet?.getAttribute('r:id')
    ?? sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
  if (!relationshipId) throw new Error('missing-sheet')

  const relationshipDocument = parser.parseFromString(strFromU8(relationshipBytes), 'application/xml')
  const relationship = elementsByLocalName(relationshipDocument, 'Relationship')
    .find((candidate) => candidate.getAttribute('Id') === relationshipId)
  const target = relationship?.getAttribute('Target')
  if (!target) throw new Error('missing-sheet-relationship')

  const worksheetPath = resolvePartPath(workbookPath, target)
  const worksheetBytes = archive[worksheetPath]
  if (!worksheetBytes) throw new Error('missing-worksheet')

  const updated = updateWorksheet(strFromU8(worksheetBytes), settings, segments)
  archive[worksheetPath] = strToU8(updated.xml)
  return {
    bytes: zipSync(archive, { level: 6 }),
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    targetColumn: updated.targetColumn,
  }
}

function exportDelimited(
  originalFile: ArrayBuffer,
  settings: ImportSettings,
  segments: Segment[],
  delimiter: ',' | '\t',
): ExportedFile {
  const originalBytes = new Uint8Array(originalFile)
  const hasBom = originalBytes[0] === 0xef && originalBytes[1] === 0xbb && originalBytes[2] === 0xbf
  const decoded = new TextDecoder().decode(originalBytes)
  const rows = parseDelimited(decoded.replace(/^\uFEFF/, ''), delimiter)
  const maxColumns = Math.max(0, ...rows.map((row) => row.length))
  const targetColumn = settings.targetColumn ?? maxColumns

  for (const segment of segments) {
    if (!segment.sourceRow) continue
    while (rows.length < segment.sourceRow) rows.push([])
    const row = rows[segment.sourceRow - 1]
    while (row.length <= targetColumn) row.push('')
    row[targetColumn] = segment.target
  }
  if (settings.targetColumn == null && settings.startRow > 1) {
    while (rows.length < settings.startRow - 1) rows.push([])
    const header = rows[settings.startRow - 2]
    while (header.length <= targetColumn) header.push('')
    header[targetColumn] = settings.targetLanguage
  }

  const lineEnding = decoded.includes('\r\n') ? '\r\n' : '\n'
  const content = serializeDelimited(rows, delimiter, lineEnding)
  const encoded = new TextEncoder().encode(`${hasBom ? '\uFEFF' : ''}${content}`)
  const extension = delimiter === '\t' ? 'tsv' : 'csv'
  return {
    bytes: encoded,
    extension,
    mimeType: delimiter === '\t' ? 'text/tab-separated-values;charset=utf-8' : 'text/csv;charset=utf-8',
    targetColumn,
  }
}

export function buildTranslatedExport(
  originalFile: ArrayBuffer,
  filename: string,
  settings: ImportSettings,
  segments: Segment[],
) {
  const lowerName = filename.toLowerCase()
  if (lowerName.endsWith('.xlsx')) return exportXlsx(originalFile, settings, segments)
  if (lowerName.endsWith('.csv')) return exportDelimited(originalFile, settings, segments, ',')
  if (lowerName.endsWith('.tsv')) return exportDelimited(originalFile, settings, segments, '\t')
  throw new Error('unsupported-export')
}

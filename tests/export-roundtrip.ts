import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { strFromU8, unzipSync } from 'fflate'
import readXlsxFile from 'read-excel-file/node'
import { buildTranslatedExport } from '../src/fileExport.ts'
import type { ImportSettings, Segment } from '../src/types.ts'

const dom = new JSDOM('', { contentType: 'text/html' })
Object.assign(globalThis, {
  DOMParser: dom.window.DOMParser,
  XMLSerializer: dom.window.XMLSerializer,
})

const fixturePath = resolve('tests/fixtures/export-formatted.xlsx')
const outputPath = resolve(tmpdir(), 'lingoforge-exported.xlsx')
const original = await readFile(fixturePath)
const settings: ImportSettings = {
  sheetName: '翻译表',
  sourceColumn: 0,
  targetColumn: 1,
  startRow: 2,
  sourceLanguage: '简体中文',
  targetLanguage: '越南语',
  nonTranslatablePattern: '<[^>]+>|%s',
}
const segments: Segment[] = [
  { id: 1, source: '领取<color=#fff>奖励</color>', target: 'Nhận <color=#fff>phần thưởng</color>', status: 'translated', sourceRow: 2 },
  { id: 2, source: '服务器已开启', target: '', status: 'untranslated', sourceRow: 3 },
  { id: 3, source: '累计充值达到%s元', target: 'Tích lũy nạp đạt %s NDT', status: 'translated', sourceRow: 4 },
]

const exported = buildTranslatedExport(original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength), 'fixture.xlsx', settings, segments)
await writeFile(outputPath, exported.bytes)
assert.equal(exported.targetColumn, 1)

const rows = (await readXlsxFile(outputPath)).find((sheet) => sheet.sheet === '翻译表')?.data ?? []
assert.equal(rows[1][1], 'Nhận <color=#fff>phần thưởng</color>')
assert.equal(rows[2][1], null)
assert.equal(rows[3][1], 'Tích lũy nạp đạt %s NDT')
assert.equal(rows[1][2], '格式必须保留')

const originalArchive = unzipSync(new Uint8Array(original))
const exportedArchive = unzipSync(exported.bytes)
assert.deepEqual(exportedArchive['xl/styles.xml'], originalArchive['xl/styles.xml'])
assert.deepEqual(exportedArchive['xl/worksheets/sheet2.xml'], originalArchive['xl/worksheets/sheet2.xml'])
assert.deepEqual(exportedArchive['xl/workbook.xml'], originalArchive['xl/workbook.xml'])

const originalSheet = new DOMParser().parseFromString(strFromU8(originalArchive['xl/worksheets/sheet1.xml']), 'application/xml')
const exportedSheet = new DOMParser().parseFromString(strFromU8(exportedArchive['xl/worksheets/sheet1.xml']), 'application/xml')
const originalStyle = Array.from(originalSheet.getElementsByTagNameNS('*', 'c')).find((cell) => cell.getAttribute('r') === 'B2')?.getAttribute('s')
const exportedStyle = Array.from(exportedSheet.getElementsByTagNameNS('*', 'c')).find((cell) => cell.getAttribute('r') === 'B2')?.getAttribute('s')
assert.equal(exportedStyle, originalStyle)

const appendResult = buildTranslatedExport(
  original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength),
  'fixture.xlsx',
  { ...settings, targetColumn: null },
  segments,
)
const appendedPath = resolve(tmpdir(), 'lingoforge-exported-appended.xlsx')
await writeFile(appendedPath, appendResult.bytes)
assert.equal(appendResult.targetColumn, 3)
const appendedRows = (await readXlsxFile(appendedPath)).find((sheet) => sheet.sheet === '翻译表')?.data ?? []
assert.equal(appendedRows[0][3], '越南语')
assert.equal(appendedRows[1][3], 'Nhận <color=#fff>phần thưởng</color>')
assert.equal(appendedRows[3][3], 'Tích lũy nạp đạt %s NDT')

const csvSource = new TextEncoder().encode('\uFEFF原文,译文,说明\r\n"包含,逗号",旧译文,保留\r\n普通文本,,保留')
const csvResult = buildTranslatedExport(
  csvSource.buffer,
  'fixture.csv',
  { ...settings, sheetName: 'CSV' },
  [
    { id: 1, source: '包含,逗号', target: 'Bản,dịch', status: 'translated', sourceRow: 2 },
    { id: 2, source: '普通文本', target: 'Văn bản', status: 'translated', sourceRow: 3 },
  ],
)
const csvText = new TextDecoder().decode(csvResult.bytes)
assert.deepEqual(Array.from(csvResult.bytes.slice(0, 3)), [0xef, 0xbb, 0xbf])
assert.ok(csvText.includes('"Bản,dịch"'))
assert.ok(csvText.includes('普通文本,Văn bản,保留'))

const tsvSource = new TextEncoder().encode('原文\t说明\r\n第一行\t保留')
const tsvResult = buildTranslatedExport(
  tsvSource.buffer,
  'fixture.tsv',
  { ...settings, sheetName: 'TSV', targetColumn: null },
  [{ id: 1, source: '第一行', target: 'Dòng đầu', status: 'translated', sourceRow: 2 }],
)
const tsvText = new TextDecoder().decode(tsvResult.bytes)
assert.ok(tsvText.includes('原文\t说明\t越南语'))
assert.ok(tsvText.includes('第一行\t保留\tDòng đầu'))

console.log(JSON.stringify({
  outputPath,
  existingTargetColumn: exported.targetColumn,
  appendedTargetColumn: appendResult.targetColumn,
  preservedParts: ['styles.xml', 'sheet2.xml', 'workbook.xml'],
  verifiedRows: [2, 3, 4],
  delimitedFormats: ['csv', 'tsv'],
}))

import type { TermEntry, TranslationMemoryEntry } from './types'

export const seedTranslationMemory: TranslationMemoryEntry[] = [
  { id: 'tm-1', source: '欢迎少侠归来。', target: 'Chào mừng thiếu hiệp trở lại.', project: '无名 · 主线剧情' },
  { id: 'tm-2', source: '新的旅程即将开始。', target: 'Một hành trình mới sắp bắt đầu.', project: '无名 · 主线剧情' },
  { id: 'tm-3', source: '湖畔游玩', target: 'Dạo chơi bên hồ', project: '无名 · 场景文本' },
  { id: 'tm-4', source: '晴朗夏日同行', target: 'Đồng hành trong ngày hè nắng đẹp', project: '奇迹3 · 道具名称' },
  { id: 'tm-5', source: '服务器将在5分钟后关闭。', target: 'Máy chủ sẽ đóng sau 5 phút.', project: '系统公告' },
  { id: 'tm-6', source: '点击屏幕继续', target: 'Nhấn màn hình để tiếp tục', project: '系统文本' },
  { id: 'tm-7', source: '活动结束后通过邮件发放奖励。', target: 'Phần thưởng sẽ được gửi qua thư sau khi sự kiện kết thúc.', project: '活动文案' },
  { id: 'tm-8', source: '绑定后无法交易', target: 'Không thể giao dịch sau khi khóa', project: '道具与装备' },
]

export const seedTerms: TermEntry[] = [
  { source: '少侠', target: 'thiếu hiệp', status: 'approved' },
  { source: '灵石', target: 'Linh Thạch', status: 'approved' },
  { source: '服务器', target: 'máy chủ', status: 'approved' },
  { source: '角色', target: 'nhân vật', status: 'approved' },
  { source: '装备', target: 'trang bị', status: 'approved' },
  { source: '活动', target: 'sự kiện', status: 'approved' },
  { source: '奖励', target: 'phần thưởng', status: 'approved' },
  { source: '金币', target: 'vàng', status: 'approved' },
  { source: '攻击力', target: 'sức tấn công', status: 'approved' },
  { source: '全服', target: 'toàn máy chủ', status: 'approved' },
]

function normalizeText(value: string) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/[\s，。！？、；：,.!?;:'"“”‘’（）()\[\]{}<>]/g, '')
    .toLowerCase()
}

function bigrams(value: string) {
  if (value.length < 2) return value ? [value] : []
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2))
}

export function similarityScore(left: string, right: string) {
  const normalizedLeft = normalizeText(left)
  const normalizedRight = normalizeText(right)
  if (!normalizedLeft || !normalizedRight) return 0
  if (normalizedLeft === normalizedRight) return 100

  const contained = normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)
  const leftBigrams = bigrams(normalizedLeft)
  const rightBigrams = bigrams(normalizedRight)
  const remaining = [...rightBigrams]
  let intersection = 0

  for (const bigram of leftBigrams) {
    const index = remaining.indexOf(bigram)
    if (index >= 0) {
      intersection += 1
      remaining.splice(index, 1)
    }
  }

  const dice = (2 * intersection) / Math.max(1, leftBigrams.length + rightBigrams.length)
  const lengthRatio = Math.min(normalizedLeft.length, normalizedRight.length) / Math.max(normalizedLeft.length, normalizedRight.length)
  const score = dice * 0.78 + lengthRatio * 0.22 + (contained ? 0.12 : 0)
  return Math.min(99, Math.round(score * 100))
}

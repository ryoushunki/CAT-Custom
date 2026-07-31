import type { ProjectFile, Segment } from './types'

export const projectFiles: ProjectFile[] = [
  {
    id: 'main-story',
    name: '主线剧情.xlsx',
    sourceLanguage: '简体中文',
    targetLanguage: '越南语',
    progress: 68,
    segmentCount: 286,
    updatedAt: '刚刚',
  },
  {
    id: 'items',
    name: '道具与装备.xlsx',
    sourceLanguage: '简体中文',
    targetLanguage: '越南语',
    progress: 42,
    segmentCount: 164,
    updatedAt: '12分钟前',
  },
  {
    id: 'events',
    name: '活动文案_7月.xlsx',
    sourceLanguage: '简体中文',
    targetLanguage: '越南语',
    progress: 91,
    segmentCount: 98,
    updatedAt: '昨天',
  },
]

export const initialSegments: Segment[] = [
  {
    id: 1,
    source: '欢迎回来，少侠。新的旅程即将开始。',
    target: 'Chào mừng thiếu hiệp trở lại. Một hành trình mới sắp bắt đầu.',
    status: 'translated',
    match: 96,
  },
  {
    id: 2,
    source: '<color=#2aff1f>战</color>天斗地，至死方休。',
    target: '<color=#2aff1f>Chiến</color> đấu với trời đất, đến chết mới thôi.',
    status: 'review',
    match: 78,
    note: '包含颜色标签，请检查标签位置。',
    protectedElements: ['<color=#2aff1f>', '</color>'],
  },
  {
    id: 3,
    source: '恭喜获得%s枚灵石',
    target: 'Chúc mừng nhận được %s Linh Thạch',
    status: 'translated',
    match: 100,
    protectedElements: ['%s'],
  },
  {
    id: 4,
    source: '湖畔携游',
    target: '',
    status: 'untranslated',
    match: 71,
  },
  {
    id: 5,
    source: '服务器即将在10分钟后关闭，请及时下线。',
    target: 'Máy chủ sẽ đóng sau 10 phút, vui lòng đăng xuất kịp thời.',
    status: 'translated',
    match: 88,
  },
  {
    id: 6,
    source: '晴夏伴行',
    target: '',
    status: 'untranslated',
    match: 64,
    note: '道具名称，保持名词结构，不要补充主语。',
  },
  {
    id: 7,
    source: '今日剩余挑战次数：{0}',
    target: 'Số lần khiêu chiến còn lại hôm nay: {0}',
    status: 'translated',
    match: 93,
    protectedElements: ['{0}'],
  },
  {
    id: 8,
    source: '点击任意位置继续',
    target: 'Nhấn vào vị trí bất kỳ để tiếp tục',
    status: 'translated',
    match: 84,
  },
  {
    id: 9,
    source: '草色入帘',
    target: '',
    status: 'untranslated',
    match: 58,
    note: '诗意场景文案，需要本地化表达。',
  },
  {
    id: 10,
    source: '网络连接中断，请稍后重试。',
    target: 'Kết nối mạng bị gián đoạn, vui lòng thử lại sau.',
    status: 'translated',
    match: 99,
  },
]

export const itemSegments: Segment[] = [
  { id: 1, source: '玄铁长剑', target: 'Trường Kiếm Huyền Thiết', status: 'translated', match: 100 },
  { id: 2, source: '使用后永久提升角色攻击力。', target: 'Sau khi sử dụng, tăng vĩnh viễn sức tấn công của nhân vật.', status: 'translated', match: 91 },
  { id: 3, source: '<color=#9df19b>稀有</color>装备', target: '<color=#9df19b>Trang bị hiếm</color>', status: 'review', match: 82, note: '请检查颜色标签包裹范围。', protectedElements: ['<color=#9df19b>', '</color>'] },
  { id: 4, source: '白垩石', target: '', status: 'untranslated', match: 67, note: '道具名称，避免逐字拆分。' },
  { id: 5, source: '绑定后不可交易', target: 'Không thể giao dịch sau khi khóa', status: 'translated', match: 97 },
  { id: 6, source: '剩余数量：{0}', target: 'Số lượng còn lại: {0}', status: 'translated', match: 100, protectedElements: ['{0}'] },
]

export const eventSegments: Segment[] = [
  { id: 1, source: '七日登录，豪礼不断！', target: 'Đăng nhập 7 ngày, nhận quà không ngừng!', status: 'translated', match: 94 },
  { id: 2, source: '活动时间：7月15日-7月22日', target: 'Thời gian sự kiện: 15/7 - 22/7', status: 'translated', match: 98 },
  { id: 3, source: '累计充值达到%s元', target: 'Tổng nạp đạt %s NDT', status: 'review', match: 79, note: '币种需要根据发行地区调整。', protectedElements: ['%s'] },
  { id: 4, source: '全服排名奖励', target: 'Phần thưởng xếp hạng toàn máy chủ', status: 'translated', match: 88 },
  { id: 5, source: '奖励将在活动结束后通过邮件发放。', target: 'Phần thưởng sẽ được gửi qua thư sau khi sự kiện kết thúc.', status: 'translated', match: 92 },
]

export const initialSegmentsByFile: Record<string, Segment[]> = {
  'main-story': initialSegments,
  items: itemSegments,
  events: eventSegments,
}

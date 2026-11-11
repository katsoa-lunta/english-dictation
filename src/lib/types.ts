/** 听写练习中的单词状态 */
export type WordResult = {
  word: string;
  /** 用户提交的拼写 */
  spelling: string;
  correct: boolean;
};

/** 练习阶段 */
export type Stage = 'upload' | 'practice' | 'result';

/** OCR 接口响应 */
export type OcrResponse = {
  words?: string[];
  error?: string;
};

/** TTS 接口响应 */
export type TtsResponse = {
  audioUri?: string;
  cached?: boolean;
  error?: string;
};

/** 语速档位（映射到 TTS speechRate: -50 ~ 100） */
export const SPEECH_RATES = [
  { label: '慢速', value: -20 },
  { label: '标准', value: 0 },
  { label: '快速', value: 30 },
] as const;

export const DEFAULT_SPEECH_RATE = 0;

/** 校验并清洗一个单词/短语，非法则返回 null */
export function sanitizeWord(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (cleaned.length < 1 || cleaned.length > 40) return null;
  // 仅允许英文字母、空格、连字符、撇号
  if (!/^[a-z][a-z\s''-]*$/.test(cleaned)) return null;
  return cleaned;
}

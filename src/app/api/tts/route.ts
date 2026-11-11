import { NextRequest, NextResponse } from 'next/server';
import { TTSClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { sanitizeWord } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * TTS 调用频率控制策略（层层递进）：
 * 1. 内存缓存：相同「单词 + 语速」直接命中缓存，不重复调用上游（学生反复听同一词是高频场景）
 * 2. 请求去重：并发请求同一单词时共享同一个进行中的合成 Promise，只调一次上游
 * 3. 滑动窗口限流：每个 IP 每分钟最多 30 次「真正发起合成」的请求
 * 4. 入参白名单校验：只接受合法单词字符，避免长文本滥用
 */

const SPEAKER = 'zh_female_vv_uranus_bigtts'; // 中英双语发音人
const CACHE_MAX_ENTRIES = 300;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

type CacheEntry = { audioUri: string; createdAt: number };

// 挂在 globalThis 上，避免 dev HMR 重编译时缓存/限流状态丢失
const globalStore = globalThis as unknown as {
  __ttsCache?: Map<string, CacheEntry>;
  __ttsRateWindow?: Map<string, number[]>;
  __ttsInflight?: Map<string, Promise<string>>;
};

const ttsCache = (globalStore.__ttsCache ??= new Map<string, CacheEntry>());
const rateWindow = (globalStore.__ttsRateWindow ??= new Map<string, number[]>());
const ttsInflight = (globalStore.__ttsInflight ??= new Map<string, Promise<string>>());

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateWindow.get(ip) ?? []).filter(
    t => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateWindow.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  rateWindow.set(ip, timestamps);
  return false;
}

function cacheKey(word: string, rate: number): string {
  return `${word}::${rate}`;
}

function readCache(key: string): string | null {
  const hit = ttsCache.get(key);
  if (!hit) return null;
  // LRU：命中后移到末尾
  ttsCache.delete(key);
  ttsCache.set(key, hit);
  return hit.audioUri;
}

function writeCache(key: string, audioUri: string): void {
  if (ttsCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = ttsCache.keys().next().value;
    if (oldestKey !== undefined) ttsCache.delete(oldestKey);
  }
  ttsCache.set(key, { audioUri, createdAt: Date.now() });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      word?: unknown;
      rate?: unknown;
    } | null;

    const rawWord = typeof body?.word === 'string' ? body.word : '';
    const word = sanitizeWord(rawWord);
    if (!word) {
      return NextResponse.json({ error: '无效的单词' }, { status: 400 });
    }

    let rate = typeof body?.rate === 'number' ? Math.round(body.rate) : 0;
    rate = Math.max(-50, Math.min(100, rate)); // clamp 到 SDK 支持的范围

    const key = cacheKey(word, rate);

    // 1. 缓存命中
    const cachedUri = readCache(key);
    if (cachedUri) {
      return NextResponse.json({ audioUri: cachedUri, cached: true });
    }

    // 2. 并发去重：复用进行中的合成请求
    const pending = ttsInflight.get(key);
    if (pending) {
      const sharedUri = await pending;
      return NextResponse.json({ audioUri: sharedUri, cached: true });
    }

    // 3. 限流（只有真正要发起合成的请求才计数）
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: '请求太频繁啦，请稍等片刻再试' },
        { status: 429 },
      );
    }

    // 4. 发起合成
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const task = (async () => {
      const client = new TTSClient(new Config(), customHeaders);
      const response = await client.synthesize({
        uid: 'dictation-student',
        text: word,
        speaker: SPEAKER,
        audioFormat: 'mp3',
        sampleRate: 24000,
        speechRate: rate,
      });
      if (!response.audioUri) {
        throw new Error('empty audioUri from TTS upstream');
      }
      writeCache(key, response.audioUri);
      return response.audioUri;
    })();

    ttsInflight.set(key, task);
    try {
      const audioUri = await task;
      return NextResponse.json({ audioUri, cached: false });
    } finally {
      ttsInflight.delete(key);
    }
  } catch (error) {
    console.error('[tts] synthesize failed:', error);
    return NextResponse.json(
      { error: '语音合成失败，请稍后重试' },
      { status: 500 },
    );
  }
}

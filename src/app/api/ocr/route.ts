import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { sanitizeWord } from '@/lib/types';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_WORDS = 80;

const OCR_PROMPT = `你是一个英语单词识别助手。请仔细观察这张图片，提取其中出现的所有英文单词或短语。

规则：
1. 只提取英文单词/短语，忽略中文释义、音标、序号、例句和其他语言的文字
2. 图片可能是课本单词表、试卷、手写笔记或屏幕截图，可能有多栏排版
3. 每个单词输出为小写，保留必要的连字符和撇号（如 mother-in-law, don't）
4. 去重，按图片中出现的顺序排列
5. 如果图片中没有英文单词，返回空列表

严格只输出 JSON，不要输出任何其他内容，格式：
{"words": ["apple", "banana"]}`;

/** 从模型输出中稳健解析 JSON */
function parseWordsFromContent(content: string): string[] {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    return [];
  }

  const wordsRaw = (parsed as { words?: unknown }).words;
  if (!Array.isArray(wordsRaw)) return [];

  const seen = new Set<string>();
  const words: string[] = [];
  for (const item of wordsRaw) {
    if (typeof item !== 'string') continue;
    const w = sanitizeWord(item);
    if (w && !seen.has(w)) {
      seen.add(w);
      words.push(w);
      if (words.length >= MAX_WORDS) break;
    }
  }
  return words;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '请上传图片文件' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '仅支持图片文件（jpg/png/webp 等）' },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: '图片不能超过 8MB，请压缩后再试' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    const dataUri = `data:${mime};base64,${base64}`;

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const client = new LLMClient(new Config(), customHeaders);

    const response = await client.invoke(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: dataUri, detail: 'high' } },
          ],
        },
      ],
      {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0,
        thinking: 'disabled',
      },
    );

    const words = parseWordsFromContent(response.content ?? '');
    if (words.length === 0) {
      return NextResponse.json(
        { error: '没有识别到英文单词，请换一张更清晰的图片试试' },
        { status: 422 },
      );
    }

    return NextResponse.json({ words });
  } catch (error) {
    console.error('[ocr] recognize failed:', error);
    return NextResponse.json(
      { error: '单词识别失败，请稍后重试' },
      { status: 500 },
    );
  }
}

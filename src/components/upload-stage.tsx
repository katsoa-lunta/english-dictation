'use client';

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  ScanText,
  SpellCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeWord, type OcrResponse } from '@/lib/types';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type UploadStageProps = {
  onStart: (words: string[]) => void;
};

export function UploadStage({ onStart }: UploadStageProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognized, setRecognized] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const mergeWords = (incoming: string[]) => {
    setWords(prev => {
      const seen = new Set(prev);
      const merged = [...prev];
      for (const w of incoming) {
        if (!seen.has(w)) {
          seen.add(w);
          merged.push(w);
        }
      }
      return merged;
    });
  };

  const handleFile = (selected: File | null | undefined) => {
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      setError('请选择图片文件（jpg / png / webp 等）');
      return;
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      setError('图片不能超过 8MB，请压缩后再上传');
      return;
    }
    setError(null);
    setFile(selected);
    setRecognized(false);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(selected);
    previewRef.current = url;
    setPreviewUrl(url);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  const recognize = async () => {
    if (!file || recognizing) return;
    setRecognizing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/ocr', { method: 'POST', body: formData });
      const data = (await res.json()) as OcrResponse;
      if (!res.ok || !data.words) {
        setError(data.error ?? '识别失败，请重试');
        return;
      }
      setRecognized(true);
      mergeWords(data.words);
    } catch {
      setError('网络异常，识别失败，请重试');
    } finally {
      setRecognizing(false);
    }
  };

  const addManualWords = () => {
    const parts = manualText.split(/[,，;；、\n]+/);
    const valid = parts
      .map(p => sanitizeWord(p))
      .filter((w): w is string => w !== null);
    if (valid.length === 0) {
      setError('没有提取到有效单词，请检查输入（仅限英文字母）');
      return;
    }
    setError(null);
    mergeWords(valid);
    setManualText('');
    setManualOpen(false);
  };

  const addSingleWord = () => {
    const w = sanitizeWord(newWord);
    if (!w) {
      setError('请输入合法的英文单词');
      return;
    }
    setError(null);
    mergeWords([w]);
    setNewWord('');
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* 上传卡片 */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />

          {!previewUrl ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-input bg-secondary/50 p-6 text-center transition-colors hover:border-primary hover:bg-secondary"
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                <ImagePlus className="size-7" />
              </div>
              <div>
                <p className="font-semibold">拍照或上传单词表图片</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  课本单词表 / 试卷 / 手写笔记，jpg、png、webp 均可
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="单词表预览"
                className="max-h-48 w-full rounded-xl border border-border object-contain bg-secondary/30"
              />
              <div className="flex gap-2">
                <Button
                  onClick={recognize}
                  disabled={recognizing}
                  className="flex-1"
                  size="lg"
                >
                  {recognizing ? (
                    <>
                      <Loader2 className="animate-spin" />
                      正在识别单词...
                    </>
                  ) : (
                    <>
                      <ScanText />
                      {recognized ? '重新识别' : '识别单词'}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={recognizing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RefreshCw />
                  换一张
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-wrong/30 bg-wrong-soft px-4 py-3 text-sm text-wrong">
          {error}
        </div>
      )}

      {/* 单词列表编辑 */}
      {words.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">听写单词列表</p>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                共 {words.length} 个
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              点击单词上的 × 可删除识别错误的词
            </p>
            <div className="flex flex-wrap gap-2">
              {words.map((word, idx) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary py-1.5 pl-3 pr-1.5 text-sm font-medium"
                >
                  {word}
                  <button
                    type="button"
                    aria-label={`删除 ${word}`}
                    onClick={() =>
                      setWords(prev => prev.filter((_, i) => i !== idx))
                    }
                    className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-wrong-soft hover:text-wrong"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newWord}
                onChange={e => setNewWord(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSingleWord()}
                placeholder="手动补充单词，回车添加"
                autoCapitalize="none"
                autoCorrect="off"
                className="h-11"
              />
              <Button
                variant="outline"
                size="lg"
                onClick={addSingleWord}
                disabled={!newWord.trim()}
              >
                <Plus />
                添加
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 手动输入入口 */}
      {!manualOpen ? (
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="mx-auto text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          没有图片？手动输入单词
        </button>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-sm font-semibold">手动输入单词</p>
            <Textarea
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder={'用逗号或换行分隔，例如：\napple, banana\norange'}
              rows={4}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <div className="flex gap-2">
              <Button onClick={addManualWords} className="flex-1">
                <SpellCheck />
                提取单词
              </Button>
              <Button variant="ghost" onClick={() => setManualOpen(false)}>
                收起
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 底部主操作 */}
      <div className="sticky bottom-0 mt-auto -mx-4 bg-background/95 px-4 pb-4 pt-3 backdrop-blur">
        <Button
          size="lg"
          className="h-13 w-full text-base font-bold"
          disabled={words.length === 0 || recognizing}
          onClick={() => onStart(words)}
        >
          开始听写{words.length > 0 ? `（${words.length} 个单词）` : ''}
        </Button>
        {words.length === 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            先识别图片或手动添加单词，再开始听写
          </p>
        )}
      </div>
    </div>
  );
}

'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Check, ChevronRight, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useTtsPlayer } from '@/hooks/use-tts-player';
import { SPEECH_RATES, type WordResult } from '@/lib/types';

type PracticeStageProps = {
  words: string[];
  rate: number;
  reviewMode: boolean;
  onRateChange: (rate: number) => void;
  onFinish: (results: WordResult[]) => void;
  onQuit: () => void;
};

type Phase = 'answering' | 'feedback';

/** 字母提示：apple → _ _ _ _ _（保留空格/连字符位置） */
function letterHint(word: string): string {
  return word
    .replace(/[a-z]/g, '_')
    .split('')
    .join(' ');
}

function normalizeSpelling(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function PracticeStage({
  words,
  rate,
  reviewMode,
  onRateChange,
  onFinish,
  onQuit,
}: PracticeStageProps) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('answering');
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [shaking, setShaking] = useState(false);

  const { play, prefetch, playingWord, loadError, clearError } = useTtsPlayer();

  const resultsRef = useRef<WordResult[]>([]);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentWord = words[index];
  const isLastWord = index === words.length - 1;
  const progressValue = Math.round((index / words.length) * 100);
  const playing = playingWord === currentWord;

  // 切换到新单词：自动播放发音，并预取下一个单词音频
  useEffect(() => {
    const word = words[index];
    play(word, rate);
    const nextWord = words[index + 1];
    if (nextWord) {
      // 稍等当前词请求发出后再预取，避免并发抢节流窗口
      const t = setTimeout(() => prefetch(nextWord, rate), 900);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, words]);

  // 语速变化时重新播放当前单词（新语速缓存键不同，第一次会走网络）
  const handleRateChange = (value: number) => {
    onRateChange(value);
    play(currentWord, value);
  };

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const goNext = useCallback(() => {
    if (index >= words.length - 1) {
      onFinish(resultsRef.current);
      return;
    }
    setIndex(i => i + 1);
    setInput('');
    setPhase('answering');
    setLastCorrect(null);
    clearError();
    // 等渲染后聚焦，唤起手机键盘
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [index, words.length, onFinish, clearError]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (phase !== 'answering') return;
    const spelling = normalizeSpelling(input);
    if (!spelling) return;

    const correct = spelling === currentWord;
    resultsRef.current = [
      ...resultsRef.current,
      { word: currentWord, spelling, correct },
    ];
    setLastCorrect(correct);
    setPhase('feedback');

    if (!correct) {
      // 答错：轻摇输入框，并再播一遍发音（命中缓存，不额外消耗 TTS 配额）
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
      setTimeout(() => play(currentWord, rate), 500);
    }

    advanceTimerRef.current = setTimeout(
      goNext,
      correct ? 1100 : 3200,
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* 顶部：进度 + 语速 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            {reviewMode ? '错词复习' : '听写进行中'}
          </span>
          <span className="text-muted-foreground">
            第 {index + 1} / {words.length} 个
          </span>
        </div>
        <Progress value={progressValue} className="h-2" />
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {SPEECH_RATES.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => handleRateChange(r.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  rate === r.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onQuit}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            退出本次听写
          </button>
        </div>
      </div>

      {/* 播放区 */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6">
          <div className="relative">
            {playing && (
              <>
                <span className="absolute inset-0 rounded-full bg-primary/40 animate-sound-wave" />
                <span
                  className="absolute inset-0 rounded-full bg-primary/30 animate-sound-wave"
                  style={{ animationDelay: '0.4s' }}
                />
              </>
            )}
            <button
              type="button"
              aria-label="播放发音"
              onClick={() => play(currentWord, rate)}
              className="relative flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95"
            >
              <Volume2 className="size-10" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => play(currentWord, rate)}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            没听清？再听一次
          </button>
          {/* 字母数量提示（不泄露拼写） */}
          <p className="font-mono text-lg tracking-[0.2em] text-muted-foreground">
            {letterHint(currentWord)}
          </p>
          {loadError && (
            <p className="text-sm text-wrong">{loadError}</p>
          )}
        </CardContent>
      </Card>

      {/* 拼写区 / 反馈区 */}
      {phase === 'answering' ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Card className="paper-lines">
            <CardContent className="p-4">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="听到发音后，在这里拼写单词"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
                lang="en"
                className={`h-14 border-0 bg-transparent text-center text-2xl font-semibold tracking-[0.15em] shadow-none placeholder:text-base placeholder:font-normal placeholder:tracking-normal focus-visible:ring-0 ${
                  shaking ? 'animate-shake' : ''
                }`}
              />
            </CardContent>
          </Card>
          <Button
            type="submit"
            size="lg"
            className="h-13 w-full text-base font-bold"
            disabled={!input.trim()}
          >
            提交拼写
          </Button>
        </form>
      ) : (
        <Card
          className={`animate-pop-in ${
            lastCorrect
              ? 'border-correct/40 bg-correct-soft'
              : 'border-wrong/40 bg-wrong-soft'
          }`}
        >
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            {lastCorrect ? (
              <>
                <div className="flex size-14 items-center justify-center rounded-full bg-correct text-white">
                  <Check className="size-8" />
                </div>
                <p className="text-xl font-bold text-correct">拼写正确！</p>
                <p className="text-2xl font-bold tracking-[0.1em]">
                  {currentWord}
                </p>
              </>
            ) : (
              <>
                <div className="flex size-14 items-center justify-center rounded-full bg-wrong text-white">
                  <X className="size-8" />
                </div>
                <p className="text-lg font-bold text-wrong">
                  拼写错误，再记一次这个词
                </p>
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    你写的：
                    <span className="font-semibold text-wrong line-through">
                      {normalizeSpelling(input)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">正确拼写</p>
                  <p className="text-3xl font-bold tracking-[0.1em] text-correct">
                    {currentWord}
                  </p>
                </div>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={goNext}
              className="mt-1 text-muted-foreground"
            >
              {isLastWord ? '查看成绩' : '下一个'}
              <ChevronRight />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { BookOpenCheck } from 'lucide-react';
import { UploadStage } from '@/components/upload-stage';
import { PracticeStage } from '@/components/practice-stage';
import { ResultStage } from '@/components/result-stage';
import {
  DEFAULT_SPEECH_RATE,
  SPEECH_RATES,
  type Stage,
  type WordResult,
} from '@/lib/types';

const RATE_STORAGE_KEY = 'dictation-speech-rate';

export function DictationApp() {
  const [stage, setStage] = useState<Stage>('upload');
  const [queue, setQueue] = useState<string[]>([]);
  const [results, setResults] = useState<WordResult[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [rate, setRate] = useState<number>(DEFAULT_SPEECH_RATE);

  // 挂载后从本地恢复语速偏好（避免 hydration 不一致）
  useEffect(() => {
    const saved = window.localStorage.getItem(RATE_STORAGE_KEY);
    if (saved !== null) {
      const n = Number(saved);
      if (SPEECH_RATES.some(r => r.value === n)) setRate(n);
    }
  }, []);

  const handleRateChange = (value: number) => {
    setRate(value);
    window.localStorage.setItem(RATE_STORAGE_KEY, String(value));
  };

  const startPractice = (words: string[]) => {
    setQueue(words);
    setReviewMode(false);
    setStage('practice');
  };

  const finishPractice = (roundResults: WordResult[]) => {
    setResults(roundResults);
    setStage('result');
  };

  /** P1：错词复习队列 */
  const retryWrong = () => {
    const wrongWords = results.filter(r => !r.correct).map(r => r.word);
    if (wrongWords.length === 0) return;
    setQueue(wrongWords);
    setReviewMode(true);
    setStage('practice');
  };

  const restart = () => {
    setStage('upload');
    setQueue([]);
    setResults([]);
    setReviewMode(false);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-6">
      <header className="flex items-center gap-3 py-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <BookOpenCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">单词听写本</h1>
          <p className="text-xs text-muted-foreground">拍照识词 · 听音拼写</p>
        </div>
      </header>

      {stage === 'upload' && <UploadStage onStart={startPractice} />}

      {stage === 'practice' && (
        <PracticeStage
          words={queue}
          rate={rate}
          reviewMode={reviewMode}
          onRateChange={handleRateChange}
          onFinish={finishPractice}
          onQuit={restart}
        />
      )}

      {stage === 'result' && (
        <ResultStage
          results={results}
          rate={rate}
          reviewMode={reviewMode}
          onRetryWrong={retryWrong}
          onRestart={restart}
        />
      )}
    </main>
  );
}

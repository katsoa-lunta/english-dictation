'use client';

import { PartyPopper, RotateCcw, Trophy, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTtsPlayer } from '@/hooks/use-tts-player';
import type { WordResult } from '@/lib/types';

type ResultStageProps = {
  results: WordResult[];
  rate: number;
  reviewMode: boolean;
  onRetryWrong: () => void;
  onRestart: () => void;
};

function encouragement(accuracy: number): string {
  if (accuracy === 100) return '全对！太厉害了';
  if (accuracy >= 90) return '非常棒，继续保持';
  if (accuracy >= 70) return '不错哦，错词再练一遍更牢固';
  if (accuracy >= 50) return '别灰心，错词多练几次就会了';
  return '没关系，跟着错词本重新练起来';
}

export function ResultStage({
  results,
  rate,
  reviewMode,
  onRetryWrong,
  onRestart,
}: ResultStageProps) {
  const { play, playingWord } = useTtsPlayer();

  const total = results.length;
  const correctCount = results.filter(r => r.correct).length;
  const wrongResults = results.filter(r => !r.correct);
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const allCorrect = wrongResults.length === 0;

  const ringColor =
    accuracy >= 90 ? '#4f9d69' : accuracy >= 60 ? '#e8a33d' : '#d96c57';
  const circumference = 2 * Math.PI * 52;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* 成绩单 */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6">
          <div className="relative flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="size-36">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#f0eadb"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke={ringColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(accuracy / 100) * circumference} ${circumference}`}
                transform="rotate(-90 60 60)"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-bold" style={{ color: ringColor }}>
                {accuracy}
                <span className="text-xl">%</span>
              </span>
              <span className="text-xs text-muted-foreground">正确率</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-lg font-bold">
            {allCorrect ? (
              <PartyPopper className="size-5 text-primary" />
            ) : (
              <Trophy className="size-5 text-primary" />
            )}
            {encouragement(accuracy)}
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span>
              共 <b className="text-foreground">{total}</b> 词
            </span>
            <span>
              答对 <b className="text-correct">{correctCount}</b> 词
            </span>
            <span>
              答错 <b className="text-wrong">{wrongResults.length}</b> 词
            </span>
          </div>
          {reviewMode && (
            <p className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
              本轮为错词复习
            </p>
          )}
        </CardContent>
      </Card>

      {/* 错词本 */}
      {!allCorrect && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">错词本</p>
              <span className="rounded-full bg-wrong-soft px-2.5 py-0.5 text-xs font-semibold text-wrong">
                {wrongResults.length} 个待巩固
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {wrongResults.map(r => (
                <div
                  key={r.word}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold tracking-wide">
                      {r.word}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      你写成：
                      <span className="text-wrong line-through">
                        {r.spelling}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`播放 ${r.word} 的发音`}
                    onClick={() => play(r.word, rate)}
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                      playingWord === r.word
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-primary/15 text-primary hover:bg-primary/25'
                    }`}
                  >
                    <Volume2 className="size-5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 底部操作 */}
      <div className="sticky bottom-0 mt-auto -mx-4 flex flex-col gap-2 bg-background/95 px-4 pb-4 pt-3 backdrop-blur">
        {!allCorrect && (
          <Button
            size="lg"
            className="h-13 w-full text-base font-bold"
            onClick={onRetryWrong}
          >
            <RotateCcw />
            错词再练一次（{wrongResults.length} 个）
          </Button>
        )}
        <Button
          variant={allCorrect ? 'default' : 'outline'}
          size="lg"
          className="h-13 w-full text-base font-bold"
          onClick={onRestart}
        >
          换一组单词
        </Button>
      </div>
    </div>
  );
}

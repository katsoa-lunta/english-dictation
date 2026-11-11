'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TtsResponse } from '@/lib/types';

/**
 * TTS 播放器 Hook，封装频率控制：
 * - 前端内存缓存（word+rate → audioUri），重复播放不发请求
 * - 播放节流：两次播放最小间隔 700ms，防止连点刷接口
 * - prefetch：提前拉取下一个单词的音频，播放时零等待
 */
export function useTtsPlayer() {
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const lastPlayAtRef = useRef(0);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const fetchAudio = useCallback(
    async (word: string, rate: number): Promise<string | null> => {
      const key = `${word}::${rate}`;
      const hit = cacheRef.current.get(key);
      if (hit) return hit;
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word, rate }),
        });
        const data = (await res.json()) as TtsResponse;
        if (!res.ok || !data.audioUri) {
          setLoadError(data.error ?? '语音加载失败，请重试');
          return null;
        }
        setLoadError(null);
        cacheRef.current.set(key, data.audioUri);
        return data.audioUri;
      } catch {
        setLoadError('网络异常，语音加载失败');
        return null;
      }
    },
    [],
  );

  /** 仅拉取音频并缓存，不播放（用于预取下一个单词） */
  const prefetch = useCallback(
    (word: string, rate: number) => {
      void fetchAudio(word, rate);
    },
    [fetchAudio],
  );

  /** 播放指定单词发音；700ms 内的重复调用会被节流忽略 */
  const play = useCallback(
    async (word: string, rate: number) => {
      const now = Date.now();
      if (now - lastPlayAtRef.current < 700) return;
      lastPlayAtRef.current = now;

      const uri = await fetchAudio(word, rate);
      if (!uri) {
        setPlayingWord(null);
        return;
      }

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.preload = 'auto';
      }
      const audio = audioRef.current;
      audio.onended = () => setPlayingWord(null);
      audio.onerror = () => {
        setPlayingWord(null);
        setLoadError('播放失败，请再点一次试试');
      };
      audio.src = uri;
      setPlayingWord(word);
      try {
        await audio.play();
      } catch {
        // 浏览器自动播放策略拦截
        setPlayingWord(null);
        setLoadError('点一下喇叭按钮播放发音');
      }
    },
    [fetchAudio],
  );

  return { play, prefetch, playingWord, loadError, clearError: () => setLoadError(null) };
}

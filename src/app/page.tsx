import type { Metadata } from 'next';
import { DictationApp } from '@/components/dictation-app';

export const metadata: Metadata = {
  title: '英语单词听写本 - 拍照识别单词，听音拼写练习',
};

export default function Home() {
  return <DictationApp />;
}

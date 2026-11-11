import type { Metadata, Viewport } from 'next';
import { FontPreload } from '@/components/font-preload';
import './globals.css';

export const metadata: Metadata = {
  title: '英语单词听写本',
  description:
    '拍一张单词表照片，自动识别单词并逐个播放发音，孩子听写拼写、即时判对错，练习结束生成成绩单和错词本。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#fbf7ee',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh antialiased">
        <FontPreload />
        {children}
      </body>
    </html>
  );
}

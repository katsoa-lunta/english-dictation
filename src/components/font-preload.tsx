'use client';

import { useEffect } from 'react';
import ReactDOM from 'react-dom';

/** 预连接字体域名，加速首屏字体加载 */
export function FontPreload() {
  useEffect(() => {
    ReactDOM.preconnect('https://fonts.googleapis.cn');
    ReactDOM.preconnect('https://fonts.gstatic.cn', { crossOrigin: 'anonymous' });
  }, []);
  return null;
}

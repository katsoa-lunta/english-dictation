# 项目上下文

## 项目概览

**english-dictation-app**：英语单词听写应用（移动端优先，max-w-md 单列布局）。

核心流程：上传单词表图片 → OCR 识别出单词列表（可增删编辑）→ 逐个 TTS 播放发音 → 用户拼写并即时判对错 → 展示正确率与错词本 → 错词复习队列。

## 关键实现位置

| 功能 | 文件 |
|---|---|
| OCR 识别（多模态 LLM，doubao-seed-2-0-lite） | `src/app/api/ocr/route.ts` |
| TTS 合成（缓存 + 并发去重 + 滑动窗口限流） | `src/app/api/tts/route.ts` |
| 前端 TTS 播放器（缓存 + 700ms 节流 + 预取） | `src/hooks/use-tts-player.ts` |
| 阶段状态机（upload/practice/result） | `src/components/dictation-app.tsx` |
| 上传与单词编辑 | `src/components/upload-stage.tsx` |
| 听写练习（自动播放、拼写判定、语速调节） | `src/components/practice-stage.tsx` |
| 成绩单与错词本 | `src/components/result-stage.tsx` |
| 共享类型与 sanitizeWord 校验 | `src/lib/types.ts` |
| 设计规范（听写本纸张风格） | `DESIGN.md` |

## 集成约束（重要）

- TTS 发音人固定 `zh_female_vv_uranus_bigtts`（中英双语）；`speechRate` 范围 -50~100，UI 三档：慢速 -20 / 标准 0 / 快速 30。
- 改 TTS 相关代码时**必须保留**四级频率控制：内存 LRU 缓存（300 条）→ inflight 并发去重 → 每 IP 每分钟 30 次限流 → 单词白名单校验。
- `coze-coding-dev-sdk` 只能在后端（route handler）使用，且必须 `HeaderUtils.extractForwardHeaders` 转发请求头。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

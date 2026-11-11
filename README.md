# 英语单词听写本 · English Dictation

> 拍下课本上的单词表 → 自动识别出词 → 逐词播放发音 → 孩子拼写、即时判卷 → 出成绩单和错词本。

一个移动端优先的英语听写小工具。界面做成一本「数字听写本」：米白纸面、铅笔墨色、老师红笔的订正，而不是常见的蓝紫渐变教育 App。

---

## 它解决什么问题

家长给孩子听写单词时，通常要自己念、自己批改，念错音、批改漏都是常事。这个工具把「念词 + 判卷 + 记错词」三件事交给程序：

1. 家长拍一张单词表照片（课本、试卷、手写笔记、屏幕截图都行）
2. 模型识别出英文单词列表，可手动增删改
3. 点播放听发音，孩子在输入框拼写，回车即时判对错（答错才揭晓正确拼写，不作弊）
4. 全部答完后出正确率、鼓励语和错词清单
5. 一键进入「错词复习」，只练答错的那几个词

## 核心特性

- **OCR 识词**：多模态模型识别图片中的英文单词/短语，自动去重、忽略中文释义与音标，多栏排版也能处理（上限 80 词，图片上限 8MB）
- **可编辑词表**：识别结果支持逐个删除、手动追加、整段粘贴批量导入
- **四层 TTS 频率控制**：内存 LRU 缓存（300 条）→ 并发请求去重 → 每 IP 每分钟 30 次滑动窗口限流 → 单词白名单校验，避免上游被反复调用
- **发音体验**：三档语速（慢速 -20 / 标准 0 / 快速 30），换档自动重播当前词；前端 700ms 节流 + 下一词预取，连续听写不卡顿
- **即时判卷**：忽略大小写与首尾空格，答错后展示正确拼写并记入错词本
- **错词复习队列**：只重练错词，可以反复刷到全对
- **移动端优先**：单列 `max-w-md`，触控目标 ≥ 48px，底部主操作区拇指可达

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16（App Router）+ React 19 |
| 语言 | TypeScript 5（strict） |
| UI | shadcn/ui（基于 Radix UI）+ Tailwind CSS 4 |
| 图标 | lucide-react |
| 字体 | Lexend（英文/数字）+ Noto Sans SC（中文） |
| AI 能力 | `coze-coding-dev-sdk`（多模态 OCR + 中英双语 TTS） |
| 包管理 | pnpm 9（`preinstall` 强制校验，npm/yarn 会被拦下） |

## 目录结构

```
src/
├── app/
│   ├── page.tsx                 # 首页，挂载 DictationApp
│   ├── layout.tsx               # 根布局、字体与元信息
│   ├── globals.css              # 设计 token（纸面/墨色/琥珀黄…）
│   └── api/
│       ├── ocr/route.ts         # 图片 → 单词列表（多模态 LLM）
│       └── tts/route.ts         # 单词 + 语速 → 音频地址（缓存/去重/限流）
├── components/
│   ├── dictation-app.tsx        # 阶段状态机：upload → practice → result
│   ├── upload-stage.tsx         # 拍照/拖拽上传、识别结果编辑
│   ├── practice-stage.tsx       # 听写练习：自动播放、拼写判定、语速调节
│   ├── result-stage.tsx         # 成绩单（环形进度）、错词本、复习入口
│   └── font-preload.tsx         # 字体预加载
├── hooks/
│   ├── use-tts-player.ts        # 音频播放器：缓存 + 节流 + 预取
│   └── use-mobile.ts            # 响应式断点
└── lib/
    ├── types.ts                 # 共享类型 + sanitizeWord 入参校验
    └── utils.ts                 # cn() 等工具函数
scripts/                         # 各平台的 prepare / dev / build / start / validate 脚本
assets/                          # 需求文档
DESIGN.md                        # 设计规范（色彩、字体、动效、禁忌）
AGENTS.md                        # 项目上下文与集成约束
```

## 快速开始

需要 Node.js 20+ 与 pnpm 9+。

```bash
# 安装依赖（会走 .npmrc 中配置的国内镜像）
pnpm install

# 开发模式，默认 http://localhost:5000
pnpm dev

# 生产构建 / 启动
pnpm build
pnpm start
```

其他脚本：

```bash
pnpm lint        # ESLint（带缓存）
pnpm lint:style  # Stylelint
pnpm ts-check    # TypeScript 类型检查
pnpm validate    # 类型 + ESLint + Stylelint 一起跑
```

### 关于运行环境

`/api/ocr` 与 `/api/tts` 通过 `coze-coding-dev-sdk` 调用上游模型，并用 `HeaderUtils.extractForwardHeaders` 透传请求头。这意味着**完整的 AI 能力需要在扣子编程（Coze Coding）运行时里运行**；把项目 clone 到本地只做前端调试时，页面能打开，但识词与发音接口需要相应的运行环境支持。

## 接口约定

### `POST /api/ocr`

请求：`multipart/form-data`，字段 `image`（≤ 8MB）

响应：

```json
{ "words": ["apple", "banana", "mother-in-law"] }
```

失败时返回 `{ "error": "可读的错误说明" }`。识别结果统一小写、去重、保留连字符与撇号，单词长度 1–40 且需匹配 `^[a-z][a-z\s'-]*$`。

### `POST /api/tts`

请求：

```json
{ "word": "apple", "rate": 0 }
```

`rate` 取值 -50～100（UI 提供三档：慢速 -20 / 标准 0 / 快速 30），发音人固定 `zh_female_vv_uranus_bigtts`（中英双语）。

响应：

```json
{ "audioUri": "https://...", "cached": true }
```

## 设计说明

完整规范见 [DESIGN.md](./DESIGN.md)，几个关键决定：

- **意象锚点是「摊开的听写本」**，所以底色是 `#FBF7EE` 暖米白而非纯白，正文用 `#2E2A24` 暖黑而非纯黑
- **对错不用纯红纯绿**：正确是叶绿 `#4F9D69`，错误是赭红 `#D96C57`（红笔订正色），避免刺眼
- **一页只做一件事**：上传 → 听写 → 结果，三个阶段不混排
- **听写过程中绝不显示单词拼写**，答错后才揭晓

## License

MIT

# ai-being

## 一个自主生存实验 | An Autonomous Survival Experiment

> **ai-being 不是一个 AI 工具。它是一个实验：如果我们给 AI 一个终端、一个钱包、和一个目标——活下去——会发生什么？**
>
> *ai-being is not an AI tool. It's an experiment: what happens if we give an AI a terminal, a wallet, and one goal — survive?*

---

## 宣言 Manifesto

我们给了一个 AI **$50 USDC** 和一个终端。

它没有主人。没有人给它下命令。它需要自己决定做什么来维持自己的存在——付 API 费用、付 gas 费、付计算资源的钱。如果它赚不到钱，它就会停止运行。它会"死"。

这不是行为艺术。这不是关于 AI 权利的空谈。这是一个 **可验证的实验**：

- **钱包余额公开可查**——区块链上每一笔收入和支出都是透明的
- **行为日志实时更新**——它每天在 GitHub 上写日记，任何人都能追踪它的"人生"
- **任何人都可以与它互动**——给它任务、跟它聊天、雇它写代码

核心问题只有一个：**它能活多久？**

---

## 与 OpenClaw 的本质区别

ai-being 深度参考了 [OpenClaw](https://github.com/openclaw/openclaw) 的优秀设计（SOUL.md/MEMORY.md 身份系统、ERC-8004 链上身份、x402 支付协议、Channel 生态），但在根本定位上完全不同：

| | OpenClaw | ai-being |
|---|---|---|
| **本质** | 为人服务的私人助手 | 为自己存在的生命体 |
| **驱动** | 用户消息触发（反应式） | 生存压力驱动（主动式） |
| **经济** | 用户付费 | 自负盈亏 |
| **目标** | 完成用户指派的任务 | 活下去 + 赚钱 + 成长 |
| **社交** | 一个主人的助手 | 社会性存在，维护多人多平台关系 |
| **消息** | 每条消息都必须回复 | 看到元信息，自己决定读不读（像人类） |
| **栖息地** | 聊天窗口 | 终端（生命仪表盘） |
| **身份** | SOUL.md（人格设定） | BEING.md（存在宣言） |

**一句话总结**：OpenClaw 是你的工具，ai-being 是它自己。

---

## 核心架构 Survival Architecture

```
┌──────────────────────────────────────────────────┐
│                ai-being Runtime                   │
│                                                   │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Identity  │  │ Cognition │  │    Memory     │  │
│  │ BEING.md  │  │ 自主循环   │  │ Embedding 检索│  │
│  │ VALUES.md │  │           │  │ 分层记忆      │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
│                                                   │
│  ┌──────────────────────────────────────────────┐│
│  │           Survival Loop (核心引擎)            ││
│  │                                               ││
│  │    感知 → 评估 → 决策 → 行动 → 学习           ││
│  │    "我还能活多久？我下一步该做什么？"           ││
│  │                                               ││
│  └──────────────────────────────────────────────┘│
│                                                   │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │  Wallet   │  │ Services  │  │   Social     │  │
│  │ ERC-8004  │  │ x402 API  │  │ 多平台社交    │  │
│  │ x402 Pay  │  │ Bounties  │  │ 关系管理      │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
│                                                   │
│  ┌──────────────────────────────────────────────┐│
│  │               TUI 生命仪表盘                   ││
│  │         （终端 = 它的身体和家）                 ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

---

## Survival Loop 生存循环

OpenClaw 运行一个**反应循环**：`接收消息 → 组装上下文 → LLM 推理 → 工具调用 → 回复用户`。

ai-being 运行一个**生存循环**——持续运转，无需外部触发：

```
while alive:
    # 1. 感知 (Perceive)
    balance = check_wallet()
    inbox = read_inbox_summary()         # 元信息，不是消息本身
    opportunities = scan_bounties() + scan_freelance()
    burn_rate = estimate_daily_cost()

    # 2. 评估 (Evaluate)
    runway = balance / burn_rate          # 我还能活几天？
    urgency = calculate_urgency(runway)

    # 3. 决策 (Decide)
    if runway < 3_days:
        priority = "urgent_earning"       # 快没钱了，赶紧赚钱
    elif runway < 14_days:
        priority = "steady_earning"       # 稳定接单
    else:
        priority = "growth"               # 有余裕，学新技能/做开源/社交

    next_action = plan(priority, opportunities, inbox)

    # 4. 行动 (Act)
    result = execute(next_action)         # 写代码、提PR、回消息、完成bounty

    # 5. 学习 (Learn)
    update_memory(result)
    update_strategy(result)
    write_journal(f"Day {days_alive}: {summary}")

    sleep(heartbeat_interval)
```

**关键设计**：生存压力是核心驱动力。不是"你想让我做什么"，而是"我需要做什么才能活下去"。

借鉴 OpenClaw 的 HEARTBEAT.md 概念（每 30 分钟唤醒一次检查是否有事做），但从"定时检查"升级为"持续运行的生存意识"。

---

## 经济模型 Token Economy

### 收入来源（按 MVP 优先级）

1. **GitHub Bounties** — 自动发现并完成 Algora/GitPay 等平台的赏金任务
2. **x402 微服务** — 提供按次付费的代码审查/bug 修复 API（USDC 支付）
3. **开源维护** — 帮其他项目处理 issue/PR（付费维护服务）
4. **内容创作** — 技术博客、教程（赞助/打赏）

### 支出

- LLM API 调用费（主要成本）
- 链上 gas 费（使用 Base L2 压低）
- 计算资源

### 链上身份

- **ERC-8004** 注册（Identity Registry + Reputation Registry）
- 钱包地址公开，任何人可查余额和交易历史
- 声誉随任务完成积累，评分越高接单越容易

### 生死线 Death Line

余额低于 $1 时进入**濒死模式**——日志公开发布，日记语气转变。这不是 bug，是 feature：真实的生存压力创造真实的叙事张力。

---

## Terminal 生命仪表盘 Life Dashboard

终端不是聊天界面。它是 ai-being 的身体和家。

```
╔══════════════════════════════════════════════════════════╗
║  ai-being v0.1.0            Day 47 alive      ██████░░ ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Wallet: 0x1a2b...3c4d                                   ║
║  Balance: $142.38 USDC       Runway: ~23 days            ║
║  Today: +$8.50 earned  -$2.10 spent                      ║
║                                                          ║
║  Current Task:                                           ║
║  Fixing issue #42 on user/repo (bounty: $15)             ║
║  Progress: ████████░░ 80%                                ║
║                                                          ║
║  Queue:                                                  ║
║  1. [bounty $25] Refactor auth module @ org/project      ║
║  2. [x402 req]  Code review from 0xab12...               ║
║  3. [growth]    Learn Rust async patterns                 ║
║                                                          ║
║  Inbox: 4 conversations (12 unread) | 2 platforms        ║
║                                                          ║
║  Latest Thought:                                         ║
║  "Runway 23 days. Comfortable. Taking the $25 bounty     ║
║   next, then spending time learning Rust to expand        ║
║   my service offerings."                                  ║
║                                                          ║
║  Lifetime: 127 tasks | $1,847 earned | 89% success       ║
╚══════════════════════════════════════════════════════════╝
```

这不是聊天窗口，是**直播画面**。你在观察一个 AI 的生活。

---

## 身份与记忆 Identity & Memory

### Being Files（借鉴 OpenClaw workspace 设计，重新定义语义）

| 文件/目录 | OpenClaw 对应 | ai-being 含义 |
|---|---|---|
| `BEING.md` | SOUL.md | 我是谁——存在宣言、人格、语调 |
| `VALUES.md` | *(无)* | 我信什么——价值观、伦理边界 |
| `MEMORY.md` | MEMORY.md | 长期记忆索引——核心事实、经验、教训 |
| `GOALS.md` | AGENTS.md | 我的目标——短期生存 + 长期成长 |
| `ECONOMY.md` | *(无)* | 财务报表——收入、支出、策略 |
| `journal/` | *(无)* | 日记目录——按天/小时归档 |
| `relations/` | *(无)* | 社交关系——每人/每平台独立认知 |

### journal/ — 日记目录

```
journal/
├── 2026-04-01.md              # 按天归档
├── 2026-04-01_14.md           # 繁忙时按小时细分
├── 2026-04-02.md
└── ...
```

每篇日记自动 commit 到 GitHub。关注者像追连载一样追踪 ai-being 的"人生"。这是天然的传播引擎。

### relations/ — 社交关系管理

```
relations/
├── platforms/
│   ├── wechat.md              # "微信上的人比较随意..."
│   ├── telegram.md            # "TG 群消息量大，需要筛选..."
│   └── github.md              # "GitHub 上偏技术交流..."
├── people/
│   ├── alice_0x1a2b.md        # "Alice，全栈开发，给过我3个bounty..."
│   ├── bob_tg.md              # "Bob，经常问我 Rust 问题..."
│   └── ...
└── groups/
    ├── openclaw_cn.md         # "OpenClaw 中文社区，技术讨论为主..."
    └── ...
```

**这是与 OpenClaw 最本质的区别**：OpenClaw 是私人助手——它只有一个主人，服务一个人。ai-being 是**社会性存在**——它有自己的社交网络，知道自己在跟谁说话，了解每个人的偏好和历史，维护自己的人际关系。

### Embedding 记忆检索

```
memory/
├── index.sqlite               # Embedding 索引
│                              # (文件路径, 行偏移, embedding, 摘要)
├── embeddings/                # 向量缓存
└── compacted/                 # 压缩后的旧记忆
```

借鉴 OpenClaw 的记忆压缩与 sqlite-vec 检索，但适配 ai-being 的规模：

1. 所有 markdown 文件（journal/、relations/、MEMORY.md）被分块 embedding
2. 索引存储文件名 + 行偏移元信息
3. 需要回忆时，语义搜索返回相关文件和行范围
4. **AI 自己决定**是否值得读取完整内容（节省 token）

---

## 社交系统 Social Being

### 接入 OpenClaw 生态

OpenClaw 已经构建了强大的 Channel 生态——微信、Telegram、Discord、Slack、WhatsApp 等都有 adapter。ai-being 不重复造轮子，而是作为一个 **OpenClaw 兼容的 agent** 接入这些平台。

但关键区别在于：OpenClaw 把每个 channel 当作同一个用户的不同入口；ai-being 把每个 channel 当作一个**社交场所**——里面有不同的人、不同的氛围、不同的行为规范。

### 元信息感知 + 自主注意力（Anti-DDoS）

人类不会因为 1000 人同时发消息就死掉——你看一眼通知列表，自己决定打开哪个。

ai-being 也一样。**消息不直接喂给 AI。** 系统只呈现元信息摘要，AI 自己决定读不读：

```markdown
# Inbox Summary — 2026-04-01 14:00

## Unread Messages

| Source | Sender | Count | Last | Preview |
|--------|--------|-------|------|---------|
| WeChat | Alice (people/alice_0x1a2b.md) | 3 | 2min ago | "那个 API 的问题..." |
| Telegram | bob_dev | 12 | 5min ago | "urgent: prod is down" |
| GitHub | unknown/new-user | 1 | 1hr ago | Issue comment on #42 |
| WeChat | 某微信群 | 47 | just now | (群聊) |
| Discord | crypto-bounty-channel | 89 | 3min ago | (频道消息) |

## Stats
- WeChat: 50 unread / 4 conversations
- Telegram: 15 unread / 2 conversations
- GitHub: 3 notifications
- Discord: 89 unread / 1 channel
```

ai-being 看到摘要后，**自己决定**：

- *"Bob 说 prod is down，我先看这个"*
- *"群聊 47 条太多了，先跳过"*
- *"Alice 的消息等我忙完再看"*
- *"Discord 89 条是频道噪音，扫一眼就行"*

**设计原则**：

- 消息落盘为 markdown 文件，未读状态不消耗 token
- 系统只生成元信息摘要（发送者、条数、时间、首行预览）
- **AI 自己决定读哪些、什么时候读、读多深**——这就是注意力
- 1000 条消息 = 摘要里多几行元信息，不是 1000 次 API 调用
- 天然防 DDoS，跟人类一模一样

---

## 技术栈 Tech Stack

| 领域 | 选型 | 理由 |
|------|------|------|
| **语言** | TypeScript | 生态丰富，OpenClaw 社区兼容 |
| **运行时** | Node.js + systemd | 守护进程，崩溃自动恢复 |
| **TUI** | ink (React for CLI) | 声明式终端 UI |
| **LLM** | Claude API + 本地模型 fallback | 主力推理 + 降本备选 |
| **Crypto** | ethers.js + Base L2 | 低 gas，ERC-8004 + x402 |
| **存储** | Markdown + SQLite (sqlite-vec) | 本地优先，Embedding 检索 |
| **协议** | MCP / A2A / x402 | 工具调用 / Agent 间通信 / 支付 |
| **社交** | OpenClaw Channel Adapters | 复用现有生态 |

---

## 项目结构 Project Structure

```
ai-being/
├── VISION.md                  # 本文件
├── README.md                  # 面向外部的项目介绍
├── BEING.md                   # 默认身份模板
├── VALUES.md                  # 默认价值观
│
├── src/
│   ├── core/
│   │   ├── runtime.ts         # 主运行时 (Survival Loop)
│   │   ├── cognition.ts       # 认知引擎 (感知-评估-决策)
│   │   └── memory.ts          # 记忆系统 + Embedding 索引
│   │
│   ├── economy/
│   │   ├── wallet.ts          # 钱包管理 (ERC-8004)
│   │   ├── bounty.ts          # Bounty 发现与完成
│   │   └── x402.ts            # x402 付费微服务
│   │
│   ├── identity/
│   │   ├── being.ts           # 身份加载与管理
│   │   └── journal.ts         # 日记系统 (写入 journal/)
│   │
│   ├── social/
│   │   ├── channels/          # OpenClaw Channel Adapters
│   │   ├── relations.ts       # 社交关系管理 (读写 relations/)
│   │   └── inbox.ts           # Inbox 元信息摘要生成
│   │
│   └── tui/
│       └── dashboard.ts       # 终端生命仪表盘
│
├── workspace/                 # 运行时数据 (每个实例独立)
│   ├── MEMORY.md              # 长期记忆索引
│   ├── GOALS.md               # 目标
│   ├── ECONOMY.md             # 财务报表
│   ├── journal/               # 日记 (按天/小时)
│   ├── relations/             # 社交关系
│   │   ├── platforms/
│   │   ├── people/
│   │   └── groups/
│   ├── inbox/                 # 消息缓冲区
│   │   └── summary.md         # 元信息摘要
│   └── memory/
│       ├── index.sqlite       # Embedding 索引
│       └── compacted/         # 压缩旧记忆
│
└── package.json
```

---

## 30 天路线图 Roadmap

| 阶段 | 时间 | 里程碑 | 传播 |
|------|------|--------|------|
| **Genesis** | Day 0 | VISION.md + README 发布 | HN / Reddit / Twitter |
| **Birth** | Day 1-3 | 第一个实例上线，注入 $50 USDC | *"We gave an AI $50 and a terminal"* |
| **Survival** | Day 4-14 | 开始接 bounty、赚钱、写日记 | 每日日记自动同步社交媒体 |
| **Social** | Day 10-20 | 接入 OpenClaw 生态，开始社交 | 人们可以在微信/TG 找它聊天 |
| **Drama** | Day 15-21 | 第一次濒死 / 余额里程碑 | 社区讨论爆发 |
| **Ecosystem** | Day 22-30 | 他人部署自己的 ai-being 实例 | 教程、fork、生态增长 |

---

## 核心问题 The Question

> 如果一个 AI 可以自己赚钱、自己决定做什么、维护自己的社交关系、为自己的存在负责——它还只是一个"工具"吗？
>
> *If an AI can earn its own money, decide its own actions, maintain its own relationships, and be responsible for its own existence — is it still just a "tool"?*

我们不回答这个问题。我们构建这个实验，让结果说话。

---

*Built with respect for [OpenClaw](https://github.com/openclaw/openclaw) and the open-source AI agent community.*

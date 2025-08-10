# AI 智能讨论平台

一个支持多种大模型API的智能讨论平台，可以让多个AI模型在同一对话中扮演不同角色，进行深度讨论和思辨。

## ✨ 主要功能

- **多模型API支持**：集成 OpenAI GPT、Claude、Gemini、Grok 等主流AI模型
- **角色化讨论**：预设6种讨论角色（批判者、支持者、综合者、创新者、专家、魔鬼代言人）
- **实时讨论**：WebSocket支持实时消息推送和讨论状态更新
- **智能压缩**：自动压缩长对话上下文，保持讨论效率
- **知识库管理**：自动提取和汇总讨论中的知识点
- **Web界面**：直观易用的网页界面

## 🚀 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 配置API密钥

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，添加你的API密钥：

```env
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GROK_API_KEY=your_grok_api_key_here

PORT=3000
```

### 3. 启动服务

开发模式：
```bash
bun dev
```

生产模式：
```bash
bun start
```

### 4. 访问应用

打开浏览器访问：http://localhost:3000

## 🎯 使用方法

1. **输入讨论话题**：在主页面输入你想讨论的问题
2. **选择参与角色**：从6种预设角色中选择至少2个参与讨论
3. **开始讨论**：点击开始按钮，AI们将开始多轮讨论
4. **查看结果**：讨论结束后自动提取知识点到知识库

## 🤖 预设角色

- **批判性思考者**：找出观点中的漏洞，提出质疑
- **支持者**：寻找观点亮点，提供支持和扩展
- **综合者**：整合不同观点，寻找平衡方案
- **创新者**：提出新颖观点和创意解决方案
- **领域专家**：基于专业知识提供权威观点
- **魔鬼代言人**：故意提出反对意见，激发深入思考

## 📡 API 接口

### 讨论相关

- `POST /api/discussions` - 创建新讨论
- `GET /api/discussions/:id` - 获取讨论详情
- `GET /api/discussions` - 获取所有讨论
- `POST /api/discussions/:id/messages` - 添加消息

### 知识库相关

- `GET /api/knowledge/search?q=查询词` - 搜索知识库
- `GET /api/knowledge/topics` - 获取所有话题
- `GET /api/knowledge/topics/:topic/summary` - 获取话题摘要
- `GET /api/knowledge/stats` - 获取知识库统计
- `GET /api/knowledge/export` - 导出知识库

### 角色相关

- `GET /api/roles` - 获取所有预设角色

## 🏗️ 项目结构

```
src/
├── config/          # 配置文件
├── models/          # AI模型适配器
├── services/        # 业务逻辑服务
├── types/           # TypeScript类型定义
├── utils/           # 工具函数
├── server.ts        # Express服务器
└── index.ts         # 入口文件

public/
└── index.html       # Web界面

data/
└── knowledge.json   # 知识库数据
```

## 🔧 自定义配置

### 修改讨论参数

在创建 `DiscussionManager` 时可以自定义：

```typescript
const discussionManager = new DiscussionManager({
  maxRounds: 5,           // 最大讨论轮数
  responseTimeout: 45000, // 响应超时时间(ms)
  enableRealTimeUpdates: true  // 是否启用实时更新
});
```

### 添加自定义角色

```typescript
const customRole = RoleManager.addCustomRole({
  name: '自定义角色',
  description: '角色描述',
  systemPrompt: '系统提示词',
  tags: ['标签1', '标签2']
});
```

## 📊 知识管理

系统会自动：
- 从讨论中提取有价值的知识点
- 按话题分类整理
- 去重和相似性检测
- 生成话题摘要
- 提供搜索功能

## 🌐 WebSocket 事件

客户端可以监听以下WebSocket事件：
- `discussion_started` - 讨论开始
- `message_received` - 收到新消息
- `round_started` - 新一轮讨论开始
- `discussion_completed` - 讨论完成
- `discussion_error` - 讨论错误

## 🚀 部署建议

1. 设置环境变量
2. 使用 PM2 或类似工具管理进程
3. 配置反向代理（Nginx）
4. 启用HTTPS
5. 设置日志轮转

## 📝 开发说明

- 使用 TypeScript 开发
- 支持 Bun 运行时
- 遵循模块化设计
- 包含完整的类型定义
- 支持热重载开发

## ⚠️ 注意事项

1. 需要有效的AI服务API密钥
2. 不同API有不同的调用限制和计费方式
3. 长时间讨论可能产生较多token消耗
4. 建议在生产环境中设置适当的速率限制

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
# Render 部署指南

本指南将帮助您将 AI Brainstorm 应用部署到 Render 平台。

## 前提条件

1. GitHub 账户
2. Render 账户 (https://render.com)
3. 至少一个 AI 提供商的 API 密钥

## 部署步骤

### 1. 推送代码到 GitHub

确保您的代码已推送到 GitHub 仓库：

```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### 2. 连接 Render 到 GitHub

1. 登录 Render Dashboard
2. 点击 "New +" 按钮
3. 选择 "Web Service"
4. 连接您的 GitHub 仓库

### 3. 配置部署设置

Render 会自动检测到 `render.yaml` 文件并使用其配置。确认以下设置：

- **Name**: ai-brainstorm
- **Environment**: Node
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`
- **Node Version**: 20.19.0

### 4. 设置环境变量

在 Render Dashboard 中设置以下环境变量：

#### 必需的环境变量

至少设置一个 AI 提供商的 API 密钥：

```
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GROK_API_KEY=your_grok_api_key_here
```

#### 可选的环境变量

```
OPENAI_MODEL=gpt-4o
CLAUDE_MODEL=claude-3-5-sonnet-20241022
GEMINI_MODEL=gemini-2.0-flash-exp
GROK_MODEL=grok-beta
AI_REQUEST_TIMEOUT=300000
MAX_CONTEXT_LENGTH=8000
COMPRESSION_RATIO=0.3
COMPRESSION_PROVIDER=gemini
```

### 5. 配置持久存储

Render 会自动为您创建一个 1GB 的持久磁盘，挂载到 `/opt/render/project/src/data`，用于 SQLite 数据库存储。

### 6. 部署

1. 点击 "Create Web Service"
2. Render 将开始构建和部署您的应用
3. 构建完成后，您的应用将在分配的 URL 上可用

## 部署后验证

1. 访问您的应用 URL
2. 检查健康状态：`https://your-app.onrender.com/api/health`
3. 验证 AI 提供商配置：`https://your-app.onrender.com/api/providers`

## 监控和日志

- 使用 Render Dashboard 查看应用日志
- 监控应用性能和资源使用情况
- 设置告警通知

## 故障排除

### 常见问题

1. **构建失败**
   - 检查 Node.js 版本是否为 20.19.0+
   - 确认所有依赖都在 package.json 中

2. **应用启动失败**
   - 检查环境变量是否正确设置
   - 查看应用日志了解具体错误

3. **AI 提供商连接失败**
   - 验证 API 密钥是否正确
   - 检查网络连接和 API 限制

4. **数据库问题**
   - 确认持久磁盘已正确挂载
   - 检查数据库文件权限

### 性能优化

1. **升级计划**
   - 如果需要更多资源，考虑升级到 Professional 计划

2. **缓存优化**
   - 使用 CDN 加速静态资源
   - 配置适当的缓存头

3. **数据库优化**
   - 定期清理旧数据
   - 监控数据库大小

## 更新应用

要更新应用，只需推送新代码到 GitHub：

```bash
git add .
git commit -m "Update application"
git push origin main
```

Render 会自动重新部署您的应用。

## 成本估算

- **Starter Plan**: 免费（有限制）
- **Professional Plan**: $7/月起
- **数据库存储**: 1GB 免费

## 安全注意事项

1. 不要在代码中硬编码 API 密钥
2. 使用环境变量管理敏感信息
3. 定期轮换 API 密钥
4. 监控 API 使用情况

部署完成后，您的 AI Brainstorm 应用就可以在 Render 上运行了！
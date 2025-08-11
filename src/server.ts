import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { DiscussionManager } from './services/DiscussionManager.js';
import { KnowledgeManager } from './services/KnowledgeManager.js';
import { RoleManager } from './services/RoleManager.js';
import { AIProviderFactory } from './models/index.js';
import { config, validateConfig } from './config/index.js';
import { DiscussionTopic } from './types/index.js';
import * as path from 'path';

class AIBrainstormServer {
  private app: express.Application;
  private server: any;
  private discussionManager: DiscussionManager;
  private knowledgeManager: KnowledgeManager;
  private publicPath!: string; // 新增成员变量

  constructor() {
    this.app = express();
    this.server = createServer(this.app);

    this.discussionManager = new DiscussionManager({
      maxRounds: 3,
      responseTimeout: 300000,
      enableRealTimeUpdates: false,
    });

    this.knowledgeManager = new KnowledgeManager();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventListeners();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // 设置并保存静态目录路径（生产环境指向 dist/public，开发指向项目根 public）
    this.publicPath =
      process.env.NODE_ENV === 'production'
        ? path.join(process.cwd(), 'dist', 'public') // 生产：dist/public（与 build 输出一致）
        : path.resolve(process.cwd(), 'public'); // 开发：项目根 public

    console.log(`📁 Serving static files from: ${path.resolve(this.publicPath)}`);
    this.app.use(express.static(this.publicPath));
  }

  private setupRoutes(): void {
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        availableProviders: AIProviderFactory.getAvailableProviders(),
        providerConfigs: Object.fromEntries(
          Object.entries(AIProviderFactory.getAllProviderConfigs())
            .filter(([, config]: [string, any]) => config.enabled)
            .map(([name, config]: [string, any]) => [
              name,
              {
                name,
                model: config.model,
                format: config.format,
                baseUrl: config.baseUrl,
                enabled: config.enabled,
              },
            ])
        ),
      });
    });

    this.app.get('/api/providers', (req: Request, res: Response) => {
      const configs = AIProviderFactory.getAllProviderConfigs();
      const providers = Object.entries(configs).map(([name, config]: [string, any]) => ({
        name,
        model: config.model,
        format: config.format,
        baseUrl: config.baseUrl,
        enabled: config.enabled,
        hasApiKey: !!config.apiKey,
      }));

      res.json({ success: true, data: providers });
    });

    this.app.get('/api/providers/:name', (req: Request, res: Response) => {
      const config = AIProviderFactory.getProviderConfig(req.params.name);

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Provider not found',
        });
      }

      res.json({
        success: true,
        data: {
          name: req.params.name,
          model: config.model,
          format: config.format,
          baseUrl: config.baseUrl,
          enabled: config.enabled,
          hasApiKey: !!config.apiKey,
        },
      });
    });

    this.app.get('/api/roles', (req: Request, res: Response) => {
      const roles = RoleManager.getAllRoles();
      res.json({ success: true, data: roles });
    });

    this.app.post('/api/discussions', async (req: Request, res: Response) => {
      try {
        const { question, context } = req.body;

        if (!question) {
          return res.status(400).json({
            success: false,
            error: 'Question is required',
          });
        }

        const topic: DiscussionTopic = {
          id: `topic_${Date.now()}`,
          question,
          context,
          participants: [], // 参与者现在由DiscussionManager内部决定
        };

        const conversationId = await this.discussionManager.startDiscussion(topic);
        const conversation = this.discussionManager.getConversation(conversationId);

        res.json({
          success: true,
          data: {
            conversationId,
            topic,
            participants: conversation ? conversation.participants : [],
          },
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    this.app.get('/api/discussions/:id', (req: Request, res: Response) => {
      const conversation = this.discussionManager.getConversation(req.params.id);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      res.json({ success: true, data: conversation });
    });

    this.app.get('/api/discussions', (req: Request, res: Response) => {
      const conversations = this.discussionManager.getAllConversations();
      res.json({ success: true, data: conversations });
    });

    this.app.post('/api/discussions/:id/messages', async (req: Request, res: Response) => {
      try {
        const { content } = req.body;

        if (!content) {
          return res.status(400).json({
            success: false,
            error: 'Message content is required',
          });
        }

        const success = this.discussionManager.addMessage(req.params.id, {
          role: 'user',
          content,
        });

        if (!success) {
          return res.status(404).json({
            success: false,
            error: 'Conversation not found',
          });
        }

        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    this.app.get('/api/knowledge/search', async (req: Request, res: Response) => {
      try {
        const { q: query, limit = '10' } = req.query;

        if (!query) {
          return res.status(400).json({
            success: false,
            error: 'Query parameter is required',
          });
        }

        const results = await this.knowledgeManager.searchKnowledge(query as string, parseInt(limit as string));

        res.json({ success: true, data: results });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    this.app.get('/api/knowledge/topics', (req: Request, res: Response) => {
      const topics = this.knowledgeManager.getTopicList();
      res.json({ success: true, data: topics });
    });

    this.app.get('/api/knowledge/topics/:topic/summary', async (req: Request, res: Response) => {
      try {
        const summary = await this.knowledgeManager.generateKnowledgeSummary(req.params.topic);
        res.json({ success: true, data: { summary } });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    this.app.get('/api/knowledge/stats', (req: Request, res: Response) => {
      const stats = this.knowledgeManager.getKnowledgeStats();
      res.json({ success: true, data: stats });
    });

    this.app.get('/api/knowledge/export', async (req: Request, res: Response) => {
      try {
        const format = (req.query.format as 'json' | 'markdown') || 'json';
        const data = await this.knowledgeManager.exportKnowledge(format);

        const contentType = format === 'markdown' ? 'text/markdown' : 'application/json';
        const filename = `knowledge_export_${new Date().getTime()}.${format === 'markdown' ? 'md' : 'json'}`;

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(data);
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Add polling endpoint for discussion status
    this.app.get('/api/discussions/:id/status', (req: Request, res: Response) => {
      try {
        const conversation = this.discussionManager.getConversation(req.params.id);

        if (!conversation) {
          return res.status(404).json({
            success: false,
            error: 'Conversation not found',
          });
        }

        res.json({
          success: true,
          data: {
            conversationId: conversation.id,
            status: conversation.status,
            messages: conversation.messages,
            participants: conversation.participants,
            currentRound: conversation.currentRound,
            maxRounds: conversation.maxRounds,
            lastUpdated: conversation.updatedAt,
          },
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // SPA fallback route
    this.app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(this.publicPath, 'index.html'), (err) => {
        if (err) res.status(404).send('index.html 不存在');
      });
    });
  }

  private setupEventListeners(): void {
    this.discussionManager.on('discussionCompleted', async (data: any) => {
      try {
        await this.knowledgeManager.extractKnowledgeFromConversation(data.conversation);
        console.log(`Knowledge extracted from conversation: ${data.conversationId}`);
      } catch (error) {
        console.error('Failed to extract knowledge:', error);
      }
    });
  }

  public start(port: number = config.port): void {
    validateConfig();

    this.server.listen(port, () => {
      console.log(`🚀 AI Brainstorm Server started on port ${port}`);
      console.log(`📊 Available AI providers: ${AIProviderFactory.getAvailableProviders().join(', ')}`);
      console.log(`📚 Knowledge management system initialized`);
      console.log(`\n💡 Ready to facilitate multi-AI discussions!`);
    });
  }
}

export default AIBrainstormServer;

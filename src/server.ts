import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { DiscussionManager } from './services/DiscussionManager.js';
import { KnowledgeManager } from './services/KnowledgeManager.js';
import { RoleManager } from './services/RoleManager.js';
import { AIProviderFactory } from './models/index.js';
import { config, validateConfig } from './config/index.js';
import { DiscussionTopic } from './types/index.js';

class AIBrainstormServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private discussionManager: DiscussionManager;
  private knowledgeManager: KnowledgeManager;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.discussionManager = new DiscussionManager({
      maxRounds: 3,
      responseTimeout: 30000,
      enableRealTimeUpdates: true
    });
    
    this.knowledgeManager = new KnowledgeManager();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupEventListeners();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  private setupRoutes(): void {
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        availableProviders: AIProviderFactory.getAvailableProviders()
      });
    });

    this.app.get('/api/roles', (req: Request, res: Response) => {
      const roles = RoleManager.getAllRoles();
      res.json({ success: true, data: roles });
    });

    this.app.post('/api/discussions', async (req: Request, res: Response) => {
      try {
        const { question, context, participants = ['critic', 'supporter', 'synthesizer'] } = req.body;

        if (!question) {
          return res.status(400).json({ 
            success: false, 
            error: 'Question is required' 
          });
        }

        const topic: DiscussionTopic = {
          id: `topic_${Date.now()}`,
          question,
          context,
          participants
        };

        const conversationId = await this.discussionManager.startDiscussion(topic, participants);
        
        res.json({ 
          success: true, 
          data: { 
            conversationId,
            topic,
            participants: participants.map(p => RoleManager.getRoleById(p))
          }
        });

      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    this.app.get('/api/discussions/:id', (req: Request, res: Response) => {
      const conversation = this.discussionManager.getConversation(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ 
          success: false, 
          error: 'Conversation not found' 
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
            error: 'Message content is required' 
          });
        }

        const success = this.discussionManager.addMessage(req.params.id, {
          role: 'user',
          content
        });

        if (!success) {
          return res.status(404).json({ 
            success: false, 
            error: 'Conversation not found' 
          });
        }

        res.json({ success: true });

      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    this.app.get('/api/knowledge/search', async (req: Request, res: Response) => {
      try {
        const { q: query, limit = '10' } = req.query;
        
        if (!query) {
          return res.status(400).json({ 
            success: false, 
            error: 'Query parameter is required' 
          });
        }

        const results = await this.knowledgeManager.searchKnowledge(
          query as string, 
          parseInt(limit as string)
        );

        res.json({ success: true, data: results });

      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
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
          error: error.message 
        });
      }
    });

    this.app.get('/api/knowledge/stats', (req: Request, res: Response) => {
      const stats = this.knowledgeManager.getKnowledgeStats();
      res.json({ success: true, data: stats });
    });

    this.app.get('/api/knowledge/export', async (req: Request, res: Response) => {
      try {
        const format = req.query.format as 'json' | 'markdown' || 'json';
        const data = await this.knowledgeManager.exportKnowledge(format);
        
        const contentType = format === 'markdown' ? 'text/markdown' : 'application/json';
        const filename = `knowledge_export_${new Date().getTime()}.${format === 'markdown' ? 'md' : 'json'}`;
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(data);

      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      console.log('New WebSocket connection');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Invalid message format' 
          }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
      });
    });
  }

  private handleWebSocketMessage(ws: any, data: any): void {
    switch (data.type) {
      case 'subscribe_discussion':
        ws.conversationId = data.conversationId;
        break;
      case 'unsubscribe_discussion':
        delete ws.conversationId;
        break;
      default:
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Unknown message type' 
        }));
    }
  }

  private setupEventListeners(): void {
    this.discussionManager.on('discussionStarted', (data) => {
      this.broadcastToClients({
        type: 'discussion_started',
        data
      });
    });

    this.discussionManager.on('messageReceived', (data) => {
      this.broadcastToClients({
        type: 'message_received',
        data
      }, data.conversationId);
    });

    this.discussionManager.on('roundStarted', (data) => {
      this.broadcastToClients({
        type: 'round_started',
        data
      }, data.conversationId);
    });

    this.discussionManager.on('discussionCompleted', async (data) => {
      this.broadcastToClients({
        type: 'discussion_completed',
        data
      }, data.conversationId);

      try {
        await this.knowledgeManager.extractKnowledgeFromConversation(data.conversation);
        console.log(`Knowledge extracted from conversation: ${data.conversationId}`);
      } catch (error) {
        console.error('Failed to extract knowledge:', error);
      }
    });

    this.discussionManager.on('discussionError', (data) => {
      this.broadcastToClients({
        type: 'discussion_error',
        data
      }, data.conversationId);
    });
  }

  private broadcastToClients(message: any, conversationId?: string): void {
    this.wss.clients.forEach((client: any) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        if (!conversationId || client.conversationId === conversationId) {
          client.send(JSON.stringify(message));
        }
      }
    });
  }

  public start(port: number = config.port): void {
    validateConfig();
    
    this.server.listen(port, () => {
      console.log(`🚀 AI Brainstorm Server started on port ${port}`);
      console.log(`📊 Available AI providers: ${AIProviderFactory.getAvailableProviders().join(', ')}`);
      console.log(`🌐 WebSocket server ready for real-time updates`);
      console.log(`📚 Knowledge management system initialized`);
      console.log(`\n💡 Ready to facilitate multi-AI discussions!`);
    });
  }
}

export default AIBrainstormServer;
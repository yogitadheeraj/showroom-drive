import { Request, Response } from 'express';
import {
  deleteConversation,
  getConversation,
  listConversations,
  streamAgentResponse,
  type AgentContext,
} from '../services/agentService.js';

export async function chatStreamController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ error: { message: 'Unauthorized' } });
      return;
    }

    const message = String(req.body?.message || '').trim();
    if (!message) {
      res.status(400).json({ error: { message: 'message is required' } });
      return;
    }

    const conversationId = req.body?.conversation_id
      ? String(req.body.conversation_id)
      : undefined;

    const context: AgentContext = {
      userId: req.authUser.uid,
      locationId: req.authUser.location_id || null,
      dealerId: req.authUser.dealer_id || null,
      role: req.authUser.role || null,
      conversationId,
    };

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 20_000);

    req.on('close', () => clearInterval(heartbeat));

    await streamAgentResponse(message, context, res);

    clearInterval(heartbeat);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent error';
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    } catch { /* connection already closed */ }
    res.end();
  }
}

export async function listConversationsController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const data = await listConversations(req.authUser.uid, limit);
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function getConversationController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }
    const data = await getConversation(req.params.id, req.authUser.uid);
    if (!data) {
      res.status(404).json({ data: null, error: { message: 'Conversation not found' } });
      return;
    }
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function deleteConversationController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }
    await deleteConversation(req.params.id, req.authUser.uid);
    res.status(200).json({ data: { deleted: true }, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

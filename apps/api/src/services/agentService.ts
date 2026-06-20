import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import { env } from '../config/env.js';
import { AgentConversation } from '../models/AgentConversation.js';
import { AGENT_TOOLS, executeTool } from './agentTools.js';

const SYSTEM_PROMPT = `You are AutoAdvant AI, a smart dealership operations assistant embedded inside the AutoAdvant showroom management platform.

Your role is to help dealership staff - sales reps, branch admins, dealer admins, GRO (Guest Relationship Officers) and security - with their daily operations.

You have access to live dealership data through tools. Use them proactively to answer questions with real numbers, not guesses.

What you can help with:
- Today's test drive schedule, status updates, and completion rates
- Customer lookups by name or phone
- Vehicle availability and inventory checks
- Staff activity summaries
- Location / showroom details
- Insights like: "How many test drives are no-shows today?", "Which vehicles are available right now?", "Who is my next customer?"

Behavior rules:
- Always use tools when the question is data-dependent - never make up numbers
- Be concise and action-oriented - staff are busy
- Use bullet points for lists of items
- Dates default to today unless specified
- If you don't know a location_id, ask the user or use the one from their profile context
- Never expose raw IDs unless specifically asked
- If no data is found, say so clearly - don't fabricate

Tone: Professional, helpful, efficient. Like a knowledgeable colleague, not a chatbot.`;

function makeClient(): OpenAI {
  if (!env.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Add it to apps/api/.env');
  }

  return new OpenAI({
    apiKey: env.geminiApiKey,
    baseURL: env.geminiBaseUrl,
  });
}

function buildSystemPrompt(context: AgentContext): string {
  const contextNote = [
    context.locationId ? `User's location_id: ${context.locationId}` : null,
    context.dealerId ? `User's dealer_id: ${context.dealerId}` : null,
    context.role ? `User's role: ${context.role}` : null,
  ].filter(Boolean).join('\n');

  return contextNote
    ? `${SYSTEM_PROMPT}\n\nCurrent user context:\n${contextNote}`
    : SYSTEM_PROMPT;
}

function sendEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function parseJsonArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface AgentContext {
  userId: string;
  locationId: string | null;
  dealerId: string | null;
  role: string | null;
  conversationId?: string;
}

export async function streamAgentResponse(
  userMessage: string,
  context: AgentContext,
  res: Response,
): Promise<void> {
  const client = makeClient();

  let conversation = context.conversationId
    ? await AgentConversation.findOne({ id: context.conversationId, user_id: context.userId })
    : null;

  if (!conversation) {
    conversation = new AgentConversation({
      id: randomUUID(),
      user_id: context.userId,
      location_id: context.locationId,
      dealer_id: context.dealerId,
      role: context.role,
      title: userMessage.slice(0, 80),
      messages: [],
    });
  }

  conversation.messages.push({
    role: 'user',
    content: userMessage,
    created_at: new Date().toISOString(),
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...conversation.messages.slice(-40).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  let fullAssistantText = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.chat.completions.create({
      model: env.geminiModel,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
    });

    const choice = response.choices[0];
    const assistantMessage = choice?.message;
    if (!assistantMessage) break;

    const text = assistantMessage.content || '';
    if (text) {
      fullAssistantText += text;
      sendEvent(res, 'delta', { text });
    }

    messages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
      tool_calls: assistantMessage.tool_calls,
    });

    const toolCalls = assistantMessage.tool_calls || [];
    if (!toolCalls.length || choice.finish_reason === 'stop') {
      break;
    }

    for (const tc of toolCalls) {
      const name = tc.function.name;
      const args = parseJsonArgs(tc.function.arguments);
      sendEvent(res, 'tool_call', { name, input: args });

      let result: unknown;
      try {
        result = await executeTool(name, args);
        sendEvent(res, 'tool_result', { name, data: result });
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
        sendEvent(res, 'tool_error', { name, error: result });
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  if (fullAssistantText) {
    conversation.messages.push({
      role: 'assistant',
      content: fullAssistantText,
      created_at: new Date().toISOString(),
    });
    conversation.updated_at = new Date().toISOString();
    await conversation.save();
  }

  sendEvent(res, 'done', { conversation_id: conversation.id });
}

export async function runAgentOnce(
  userMessage: string,
  context: AgentContext,
): Promise<string> {
  const client = makeClient();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    { role: 'user', content: userMessage },
  ];

  let finalText = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.chat.completions.create({
      model: env.geminiModel,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
    });

    const choice = response.choices[0];
    const assistantMessage = choice?.message;
    if (!assistantMessage) return finalText;

    const text = assistantMessage.content || '';
    finalText += text;

    messages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
      tool_calls: assistantMessage.tool_calls,
    });

    const toolCalls = assistantMessage.tool_calls || [];
    if (!toolCalls.length || choice.finish_reason === 'stop') {
      return finalText;
    }

    for (const tc of toolCalls) {
      const args = parseJsonArgs(tc.function.arguments);
      const result = await executeTool(tc.function.name, args);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }
}

export async function listConversations(userId: string, limit = 20) {
  const docs = await AgentConversation.find({ user_id: userId }, {
    id: 1, title: 1, created_at: 1, updated_at: 1,
    messages: { $slice: -1 },
  })
    .sort({ updated_at: -1 })
    .limit(limit)
    .lean();

  return docs.map((d: any) => ({
    id: d.id,
    title: d.title,
    last_message: d.messages?.[0]?.content?.slice(0, 100) || '',
    created_at: d.created_at,
    updated_at: d.updated_at,
  }));
}

export async function getConversation(conversationId: string, userId: string) {
  const doc = await AgentConversation.findOne({ id: conversationId, user_id: userId }).lean();
  if (!doc) return null;
  const d = doc as any;
  return {
    id: d.id,
    title: d.title,
    messages: d.messages,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
}

export async function deleteConversation(conversationId: string, userId: string) {
  await AgentConversation.deleteOne({ id: conversationId, user_id: userId });
}

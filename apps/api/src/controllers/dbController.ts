import { Request, Response } from 'express';
import { z } from 'zod';
import { runDbQuery } from '../services/databaseService.js';

const filterSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is']),
  value: z.unknown(),
});

const orderSchema = z.object({
  field: z.string().min(1),
  ascending: z.boolean().optional(),
});

const querySchema = z.object({
  table: z.string().min(1),
  action: z.enum(['select', 'insert', 'update', 'delete', 'upsert']),
  select: z.string().optional(),
  filters: z.array(filterSchema).optional(),
  order: z.array(orderSchema).optional(),
  limit: z.number().int().positive().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  values: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))]).optional(),
  options: z
    .object({
      count: z.union([z.literal('exact'), z.null()]).optional(),
      head: z.boolean().optional(),
      onConflict: z.string().optional(),
      ignoreDuplicates: z.boolean().optional(),
    })
    .optional(),
});

export async function dbQueryController(req: Request, res: Response) {
  try {
    const body = querySchema.parse(req.body);
    const result = await runDbQuery(body as any);
    res.status(200).json({ data: result.data ?? null, count: result.count ?? null, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database query failed';
    res.status(400).json({ data: null, count: null, error: { message } });
  }
}

import { Request, Response } from 'express';
import {
  createTimesheetTask,
  getTimesheetReminderConfig,
  listTimesheetReminderConfigs,
  listTimesheetTasks,
  runTimesheetReminderJobs,
  submitTimesheetTask,
  updateTimesheetTask,
  upsertTimesheetReminderConfig,
} from '../services/timesheetReminderService.js';

export async function listTimesheetReminderConfigsController(req: Request, res: Response) {
  try {
    const location_id = typeof req.query.location_id === 'string' ? req.query.location_id : undefined;
    const dealer_id = typeof req.query.dealer_id === 'string' ? req.query.dealer_id : undefined;
    const data = await listTimesheetReminderConfigs({ location_id, dealer_id });
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function getTimesheetReminderConfigController(req: Request, res: Response) {
  try {
    const locationId = typeof req.params.locationId === 'string' ? req.params.locationId : '';
    if (!locationId) {
      res.status(400).json({ data: null, error: { message: 'locationId is required' } });
      return;
    }

    const data = await getTimesheetReminderConfig(locationId);
    if (!data) {
      res.status(404).json({ data: null, error: { message: 'Config not found for this location' } });
      return;
    }

    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function upsertTimesheetReminderConfigController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }

    const data = await upsertTimesheetReminderConfig(req.authUser.uid, req.body || {});
    res.status(200).json({ data, error: null });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.startsWith('Forbidden') ? 403 : 400;
    res.status(status).json({ data: null, error: { message } });
  }
}

export async function listTimesheetTasksController(req: Request, res: Response) {
  try {
    const location_id = typeof req.query.location_id === 'string' ? req.query.location_id : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const assignee_user_id = typeof req.query.assignee_user_id === 'string' ? req.query.assignee_user_id : undefined;
    const from_due_at = typeof req.query.from_due_at === 'string' ? req.query.from_due_at : undefined;
    const to_due_at = typeof req.query.to_due_at === 'string' ? req.query.to_due_at : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

    const data = await listTimesheetTasks({
      location_id,
      status,
      assignee_user_id,
      from_due_at,
      to_due_at,
      limit,
    });

    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

export async function createTimesheetTaskController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }

    const data = await createTimesheetTask(req.authUser.uid, req.body || {});
    res.status(201).json({ data, error: null });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.startsWith('Forbidden') ? 403 : 400;
    res.status(status).json({ data: null, error: { message } });
  }
}

export async function updateTimesheetTaskController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }

    const taskId = typeof req.params.id === 'string' ? req.params.id : '';
    if (!taskId) {
      res.status(400).json({ data: null, error: { message: 'Task id is required' } });
      return;
    }

    const data = await updateTimesheetTask(req.authUser.uid, taskId, req.body || {});
    if (!data) {
      res.status(404).json({ data: null, error: { message: 'Task not found' } });
      return;
    }

    res.status(200).json({ data, error: null });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.startsWith('Forbidden') ? 403 : 400;
    res.status(status).json({ data: null, error: { message } });
  }
}

export async function submitTimesheetTaskController(req: Request, res: Response) {
  try {
    if (!req.authUser?.uid) {
      res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
      return;
    }

    const taskId = typeof req.params.id === 'string' ? req.params.id : '';
    if (!taskId) {
      res.status(400).json({ data: null, error: { message: 'Task id is required' } });
      return;
    }

    const data = await submitTimesheetTask(req.authUser.uid, taskId);
    if (!data) {
      res.status(404).json({ data: null, error: { message: 'Task not found' } });
      return;
    }

    res.status(200).json({ data, error: null });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.startsWith('Forbidden') ? 403 : 400;
    res.status(status).json({ data: null, error: { message } });
  }
}

export async function runTimesheetReminderJobsController(_req: Request, res: Response) {
  try {
    const data = await runTimesheetReminderJobs();
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: (error as Error).message } });
  }
}

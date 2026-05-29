import { Request, Response } from 'express';
import * as customerService from '../services/customerService.js';

export async function listCustomersController(req: Request, res: Response) {
  const data = await customerService.listCustomers(req.query as Record<string, unknown>);
  res.json({ data });
}

export async function getCustomerController(req: Request, res: Response) {
  const data = await customerService.getCustomerById(req.params.id);
  if (!data) return res.status(404).json({ error: 'Customer not found' });
  res.json({ data });
}

export async function createCustomerController(req: Request, res: Response) {
  const phone = String(req.body.phone || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();

  const existingByPhone = phone ? await customerService.findCustomerByPhone(phone) : null;
  if (existingByPhone) {
    return res.status(200).json({ data: existingByPhone });
  }

  const existingByEmail = email ? await customerService.findCustomerByEmail(email) : null;
  if (existingByEmail) {
    return res.status(200).json({ data: existingByEmail });
  }

  const data = await customerService.createCustomer({
    ...req.body,
    phone,
    email: email || null,
  });
  res.status(201).json({ data });
}

export async function updateCustomerController(req: Request, res: Response) {
  const current = await customerService.getCustomerById(req.params.id);
  if (!current) return res.status(404).json({ error: 'Customer not found' });

  const hasPhone = Object.prototype.hasOwnProperty.call(req.body, 'phone');
  const hasEmail = Object.prototype.hasOwnProperty.call(req.body, 'email');

  const nextPhone = hasPhone ? String(req.body.phone || '').trim() : String(current.phone || '').trim();
  const nextEmail = hasEmail
    ? String(req.body.email || '').trim().toLowerCase()
    : String(current.email || '').trim().toLowerCase();

  if (nextPhone) {
    const existingByPhone = await customerService.findCustomerByPhone(nextPhone);
    if (existingByPhone && existingByPhone.id !== req.params.id) {
      return res.status(409).json({ error: 'Another customer already uses this phone number', data: existingByPhone });
    }
  }

  if (nextEmail) {
    const existingByEmail = await customerService.findCustomerByEmail(nextEmail);
    if (existingByEmail && existingByEmail.id !== req.params.id) {
      return res.status(409).json({ error: 'Another customer already uses this email address', data: existingByEmail });
    }
  }

  const data = await customerService.updateCustomer(req.params.id, {
    ...req.body,
    phone: nextPhone || null,
    email: nextEmail || null,
  });

  res.json({ data });
}

-- Add sales_admin role for branch admin support
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_admin';

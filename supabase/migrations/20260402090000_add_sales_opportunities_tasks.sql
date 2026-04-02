-- Lead qualification and task management for post-test-drive follow-up

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'lead_temperature' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.lead_temperature AS ENUM ('hot', 'cold');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'opportunity_stage' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.opportunity_stage AS ENUM ('new', 'qualified', 'proposal', 'won', 'lost');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'task_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.task_status AS ENUM ('open', 'done', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sales_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  latest_test_drive_id UUID REFERENCES public.test_drives(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  owner_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  temperature public.lead_temperature NOT NULL DEFAULT 'cold',
  stage public.opportunity_stage NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.sales_opportunities(id) ON DELETE CASCADE,
  test_drive_id UUID REFERENCES public.test_drives(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  assigned_to_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  status public.task_status NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_opportunities_owner_profile ON public.sales_opportunities(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_customer ON public.sales_opportunities(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_assigned_to ON public.sales_tasks(assigned_to_profile_id);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_opportunity ON public.sales_tasks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_status_due ON public.sales_tasks(status, due_at);

ALTER TABLE public.sales_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_tasks ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_sales_opportunities_updated_at ON public.sales_opportunities;
CREATE TRIGGER update_sales_opportunities_updated_at
BEFORE UPDATE ON public.sales_opportunities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_tasks_updated_at ON public.sales_tasks;
CREATE TRIGGER update_sales_tasks_updated_at
BEFORE UPDATE ON public.sales_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Sales can view own opportunities" ON public.sales_opportunities;
CREATE POLICY "Sales can view own opportunities"
ON public.sales_opportunities
FOR SELECT
TO authenticated
USING (
  owner_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  OR public.has_role(auth.uid(), 'dealer_admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'gro'::public.app_role) AND location_id = public.get_user_location_id(auth.uid()))
);

DROP POLICY IF EXISTS "Sales can manage own opportunities" ON public.sales_opportunities;
CREATE POLICY "Sales can manage own opportunities"
ON public.sales_opportunities
FOR ALL
TO authenticated
USING (
  owner_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  OR public.has_role(auth.uid(), 'dealer_admin'::public.app_role)
)
WITH CHECK (
  owner_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  OR public.has_role(auth.uid(), 'dealer_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Staff can view sales tasks" ON public.sales_tasks;
CREATE POLICY "Staff can view sales tasks"
ON public.sales_tasks
FOR SELECT
TO authenticated
USING (
  assigned_to_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  OR public.has_role(auth.uid(), 'dealer_admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'gro'::public.app_role) AND customer_id IN (
    SELECT td.customer_id
    FROM public.test_drives td
    WHERE td.location_id = public.get_user_location_id(auth.uid())
  ))
);

DROP POLICY IF EXISTS "Sales can manage assigned tasks" ON public.sales_tasks;
CREATE POLICY "Sales can manage assigned tasks"
ON public.sales_tasks
FOR ALL
TO authenticated
USING (
  assigned_to_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  OR public.has_role(auth.uid(), 'dealer_admin'::public.app_role)
)
WITH CHECK (
  assigned_to_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  OR public.has_role(auth.uid(), 'dealer_admin'::public.app_role)
);

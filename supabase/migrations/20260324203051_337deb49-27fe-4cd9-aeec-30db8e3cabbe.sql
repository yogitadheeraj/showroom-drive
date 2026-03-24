
-- Allow anon users to look up existing customers by phone (for booking dedup)
CREATE POLICY "Anon can view customers by phone" ON public.customers
FOR SELECT TO anon
USING (true);

-- Allow anon users to update customer info during booking
CREATE POLICY "Anon can update customers" ON public.customers
FOR UPDATE TO anon
USING (true);

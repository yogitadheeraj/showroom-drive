CREATE POLICY "Anon can view own test drive after insert" ON public.test_drives
FOR SELECT TO anon
USING (true);
-- Improvements for Family Member Profile
-- This script adds necessary columns if they don't exist and ensures storage buckets are ready.

-- 1. Ensure familyMembers table has the new medicalRecords column
-- (Supabase handles JSONB columns quite well, assuming healthConditions is already JSONB)
-- If your table was created with specific columns, run this:
ALTER TABLE public.familyMembers 
ADD COLUMN IF NOT EXISTS medicalRecords JSONB DEFAULT '[]';

-- 2. Create Storage Buckets
-- Note: Supabase storage buckets are usually created via the UI or a separate API call.
-- If you are using SQL to manage storage (only works in some environments), you might use:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('medical_records', 'medical_records', true) ON CONFLICT (id) DO NOTHING;

-- 3. RLS for medical_records bucket (example policies)
-- (Users can only see/manage their own folders)
/*
CREATE POLICY "Users can upload their own medical records"
ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'medical_records' AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own medical records"
ON storage.objects FOR SELECT USING (
    bucket_id = 'medical_records' AND (storage.foldername(name))[1] = auth.uid()::text
);
*/

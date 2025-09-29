-- Create RLS policies for storage bucket "Slike obroka" to allow admin file uploads

-- Allow admins to upload files to "Slike obroka" bucket
CREATE POLICY "Admins can upload meal images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'Slike obroka' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- Allow admins to view all files in "Slike obroka" bucket
CREATE POLICY "Admins can view all meal images" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'Slike obroka' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- Allow everyone to view meal images (for public display)
CREATE POLICY "Everyone can view meal images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'Slike obroka');

-- Allow admins to update meal images
CREATE POLICY "Admins can update meal images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'Slike obroka' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- Allow admins to delete meal images
CREATE POLICY "Admins can delete meal images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'Slike obroka' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);
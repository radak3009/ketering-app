-- Add obradeno column to feedback table
ALTER TABLE public.feedback 
ADD COLUMN obradeno boolean NOT NULL DEFAULT false;

-- Add obradeno column to suggestions table
ALTER TABLE public.suggestions 
ADD COLUMN obradeno boolean NOT NULL DEFAULT false;

-- Create index for better performance when filtering
CREATE INDEX idx_feedback_obradeno ON public.feedback(obradeno);
CREATE INDEX idx_suggestions_obradeno ON public.suggestions(obradeno);

-- Update RLS policies to allow admins to update obradeno field
CREATE POLICY "Admins can update feedback"
ON public.feedback
FOR UPDATE
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update suggestions"
ON public.suggestions
FOR UPDATE
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));
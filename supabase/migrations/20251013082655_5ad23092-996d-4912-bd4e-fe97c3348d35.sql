-- Create security definer function to check if user can view a company
create or replace function public.can_view_company(company_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and company_id = company_uuid
  );
$$;

-- Drop the old policy
drop policy if exists "Users can view their company" on public.companies;

-- Create new policy using the security definer function
create policy "Users can view their own company"
on public.companies
for select
to authenticated
using (public.can_view_company(id));

-- Ensure only authenticated users can access companies table
-- (no public access possible even if someone knows the table exists)
comment on table public.companies is 'Contains sensitive company contact information. Access restricted to authenticated users only via RLS policies.';
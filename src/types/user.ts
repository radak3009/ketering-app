import type { Tables } from '@/integrations/supabase/types';

// Base profile type from database
export type Profile = Tables<'profiles'>;

// Lokalni literal tip (RBAC panel determinacija); NE oslanja se više na enum app_role.
// Posle drop-a kolone profiles.role (M7.3), ovo ostaje za UI panel selekciju.
export type AppRole = 'admin' | 'employee';

// Profile with role (merged from user_roles table)
export interface ProfileWithRole extends Profile {
  role: AppRole;
  role_id?: string | null;
  role_key?: string | null;
  role_name?: string | null;
}

// Basic profile info for references
export interface ProfileBasic {
  id: string;
  full_name: string | null;
  company_card_id: string | null;
}

// User creation data
export interface UserCreateData {
  full_name: string;
  email: string;
  phone?: string;
  company_card_id?: string;
  tag?: string;
  date_of_birth?: Date;
  role: string; // role key from public.roles (e.g. 'administrator', 'hr', 'zaposleni')
  password?: string;
}

// User update data
export type UserUpdateData = Partial<Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

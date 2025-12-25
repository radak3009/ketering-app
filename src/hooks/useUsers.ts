import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

export function useUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch roles for all users from user_roles table
      const { data: rolesData } = await supabase
        .from('user_roles' as any)
        .select('user_id, role');

      // Merge profiles with roles
      const usersWithRoles = (profilesData || []).map(profile => {
        const userRole = (rolesData as any)?.find((r: any) => r.user_id === profile.user_id);
        return {
          ...profile,
          role: userRole?.role || 'employee'
        } as any;
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće učitati korisnike',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id: string, updates: Partial<Omit<Profile, 'role'>>) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Fetch the updated user with role from user_roles
      const { data: roleData } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', data.user_id)
        .maybeSingle();

      const updatedUser = { ...data, role: (roleData as any)?.role || null } as any;
      setUsers(prev => prev.map(user => user.id === id ? updatedUser : user));
      
      toast({
        title: 'Uspeh',
        description: 'Korisnik je uspešno ažuriran'
      });
      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće ažurirati korisnika',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const deleteUser = async (id: string) => {
    try {
      // Call the edge function to delete the user completely (from auth.users)
      // Pass the profile id, the edge function will fetch the auth user_id
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { profileId: id }
      });

      if (error) throw error;

      setUsers(prev => prev.filter(user => user.id !== id));
      toast({
        title: 'Uspeh',
        description: 'Korisnik je uspešno obrisan'
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće obrisati korisnika',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const createUser = async (userData: {
    full_name: string;
    email: string;
    phone?: string;
    company_card_id?: string;
    date_of_birth?: Date;
    role: 'admin' | 'employee';
  }) => {
    try {
      // Instead of creating a profile directly, we just send a magic link
      // The profile will be created automatically by the trigger when the user signs up
      // Note: company_card_id will need to be set by admin after user's first login
      await sendMagicLink(userData.email);
      
      toast({
        title: 'Uspeh',
        description: `Pozivnica je poslata na ${userData.email}. Korisnik će biti kreiran kada se prvi put prijavi.`
      });
      
      return null;
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće poslati pozivnicu',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const sendMagicLink = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      toast({
        title: 'Uspeh',
        description: 'Magic link je poslat na email adresu'
      });
    } catch (error) {
      console.error('Error sending magic link:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće poslati magic link',
        variant: 'destructive'
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    createUser,
    updateUser,
    deleteUser,
    sendMagicLink,
    refetch: fetchUsers
  };
}
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
      // Find current user to get user_id and check for email change
      const currentUser = users.find(u => u.id === id);
      if (!currentUser) {
        throw new Error('Korisnik nije pronađen');
      }

      // If email is being changed, use Edge Function to update auth.users and send verification
      let emailRequiresConfirmation = false;
      if (updates.email && updates.email !== currentUser.email) {
        const { data: emailResponse, error: emailError } = await supabase.functions.invoke('update-user-email', {
          body: { userId: currentUser.user_id, newEmail: updates.email }
        });

        if (emailError) {
          console.error('Email update error:', emailError);
          throw new Error(emailError.message || 'Nije moguće ažurirati email adresu');
        }

        if (emailResponse?.error) {
          throw new Error(emailResponse.error);
        }

        emailRequiresConfirmation = emailResponse?.requiresConfirmation === true;
      }

      // Update other fields in profiles table (excluding email if it was already updated)
      const profileUpdates = updates.email && updates.email !== currentUser.email
        ? { ...updates, email: undefined } // Don't update email again, it was handled by Edge Function
        : updates;

      // Remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(profileUpdates).filter(([_, v]) => v !== undefined)
      );

      let updatedData = currentUser;

      // Only call profiles update if there are other fields to update
      if (Object.keys(cleanUpdates).length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .update(cleanUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        updatedData = data;
      } else if (updates.email) {
        // If only email was updated, fetch the updated profile
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        updatedData = data;
      }

      // Fetch the updated user with role from user_roles
      const { data: roleData } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', updatedData.user_id)
        .maybeSingle();

      const updatedUser = { ...updatedData, role: (roleData as any)?.role || 'employee' } as any;
      setUsers(prev => prev.map(user => user.id === id ? updatedUser : user));
      
      // Show appropriate toast message based on whether email confirmation is required
      if (emailRequiresConfirmation) {
        toast({
          title: 'Email potvrda poslata',
          description: `Email za potvrdu je poslat na ${updates.email}. Korisnik mora da potvrdi promenu klikom na link u emailu.`
        });
      } else {
        toast({
          title: 'Uspeh',
          description: 'Korisnik je uspešno ažuriran'
        });
      }
      return updatedUser;
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'Greška',
        description: error.message || 'Nije moguće ažurirati korisnika',
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
      // Call create-user Edge Function with all user data
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: userData.email,
          full_name: userData.full_name,
          phone: userData.phone || null,
          company_card_id: userData.company_card_id || null,
          date_of_birth: userData.date_of_birth?.toISOString().split('T')[0] || null,
          role: userData.role
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Greška pri kreiranju korisnika');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Refresh users list
      await fetchUsers();
      
      toast({
        title: 'Uspeh',
        description: `Korisnik ${userData.full_name} je kreiran i pozivnica je poslata na ${userData.email}.`
      });
      
      return data?.profile || null;
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Greška',
        description: error.message || 'Nije moguće kreirati korisnika',
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
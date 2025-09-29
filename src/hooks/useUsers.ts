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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
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

  const updateUser = async (id: string, updates: Partial<Profile>) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setUsers(prev => prev.map(user => user.id === id ? data : user));
      toast({
        title: 'Uspeh',
        description: 'Korisnik je uspešno ažuriran'
      });
      return data;
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
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

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
    role: 'admin' | 'employee';
  }) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{
          user_id: '', // This will be set by the trigger when user signs up
          full_name: userData.full_name,
          email: userData.email,
          phone: userData.phone,
          role: userData.role
        }])
        .select()
        .single();

      if (error) throw error;

      // Send magic link for new user
      await sendMagicLink(userData.email);
      
      await fetchUsers(); // Refresh the list
      
      toast({
        title: 'Uspeh',
        description: 'Korisnik je uspešno kreiran i pozivnica je poslata'
      });
      
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: 'Greška',
        description: 'Nije moguće kreirati korisnika',
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
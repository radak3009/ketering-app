import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handleError, handleSuccess, getErrorMessage } from '@/services/errorService';
import type { ProfileWithRole, UserCreateData } from '@/types';

export function useUsers() {
  const [users, setUsers] = useState<ProfileWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, phone, company_card_id, tag, date_of_birth, company_id, role, password_set, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: rolesData } = await supabase
        .from('user_roles' as any)
        .select('user_id, role');

      // O(n) lookup using Map instead of O(n×m) with find()
      const roleByUserId = new Map(
        (rolesData as any[] ?? []).map((r: any) => [r.user_id, r.role])
      );

      const usersWithRoles = (profilesData || []).map(profile => ({
        ...profile,
        role: roleByUserId.get(profile.user_id) || 'employee'
      } as ProfileWithRole));

      setUsers(usersWithRoles);
    } catch (error) {
      handleError({ category: 'fetch', entity: 'korisnik', error });
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id: string, updates: Partial<Omit<ProfileWithRole, 'role'>>) => {
    try {
      const currentUser = users.find(u => u.id === id);
      if (!currentUser) {
        throw new Error('Korisnik nije pronađen');
      }

      let emailRequiresConfirmation = false;
      if (updates.email && updates.email !== currentUser.email) {
        const { data: emailResponse, error: emailError } = await supabase.functions.invoke('update-user-email', {
          body: { userId: currentUser.user_id, newEmail: updates.email }
        });

        if (emailError) {
          throw new Error(emailError.message || 'Nije moguće ažurirati email adresu');
        }

        if (emailResponse?.error) {
          throw new Error(emailResponse.error);
        }

        emailRequiresConfirmation = emailResponse?.requiresConfirmation === true;
      }

      const profileUpdates = updates.email && updates.email !== currentUser.email
        ? { ...updates, email: undefined }
        : updates;

      const cleanUpdates = Object.fromEntries(
        Object.entries(profileUpdates).filter(([_, v]) => v !== undefined)
      );

      let updatedData = currentUser;

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
        const { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, full_name, email, phone, company_card_id, tag, date_of_birth, company_id, role, password_set, created_at, updated_at')
          .eq('id', id)
          .single();

        if (error) throw error;
        updatedData = data;
      }

      const { data: roleData } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', updatedData.user_id)
        .maybeSingle();

      const updatedUser = { ...updatedData, role: (roleData as any)?.role || 'employee' } as ProfileWithRole;
      setUsers(prev => prev.map(user => user.id === id ? updatedUser : user));
      
      if (emailRequiresConfirmation) {
        toast({
          title: 'Email potvrda poslata',
          description: `Email za potvrdu je poslat na ${updates.email}. Korisnik mora da potvrdi promenu klikom na link u emailu.`
        });
      } else {
        handleSuccess({ category: 'update', entity: 'korisnik' });
      }
      return updatedUser;
    } catch (error) {
      handleError({ 
        category: 'update', 
        entity: 'korisnik', 
        error,
        customMessage: getErrorMessage(error)
      });
      throw error;
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { profileId: id }
      });

      // Check for error in response body first
      if (data?.error) {
        throw new Error(data.error);
      }

      if (error) throw new Error(error.message || 'Greška pri brisanju korisnika');

      setUsers(prev => prev.filter(user => user.id !== id));
      handleSuccess({ category: 'delete', entity: 'korisnik' });
    } catch (error) {
      handleError({ category: 'delete', entity: 'korisnik', error });
      throw error;
    }
  };

  const createUser = async (userData: UserCreateData) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: userData.email,
          full_name: userData.full_name,
          phone: userData.phone || null,
          company_card_id: userData.company_card_id || null,
          tag: userData.tag || null,
          date_of_birth: userData.date_of_birth?.toISOString().split('T')[0] || null,
          role: userData.role,
          password: userData.password || null
        }
      });

      // Check for error in response body first (edge function returns {error: "..."})
      if (data?.error) {
        throw new Error(data.error);
      }

      // Then check for network/invoke errors
      if (error) {
        // Try to extract error message from the response context
        const errorMsg = error.message || 'Greška pri kreiranju korisnika';
        throw new Error(errorMsg);
      }

      await fetchUsers();
      
      const message = userData.password 
        ? `Korisnik ${userData.full_name} je kreiran sa lozinkom. Može se prijaviti sa ${userData.email}.`
        : `Korisnik ${userData.full_name} je kreiran i pozivnica je poslata na ${userData.email}.`;
      
      toast({
        title: 'Uspeh',
        description: message
      });
      
      return data?.profile || null;
    } catch (error) {
      handleError({ 
        category: 'create', 
        entity: 'korisnik', 
        error,
        customMessage: getErrorMessage(error)
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
      handleError({ 
        category: 'auth', 
        entity: 'korisnik', 
        error,
        customMessage: 'Nije moguće poslati magic link'
      });
      throw error;
    }
  };

  const sendInvitationWithCredentials = async (userId: string, email: string, fullName?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: { userId, email, fullName }
      });

      if (error) {
        throw new Error(error.message || 'Greška pri slanju pozivnice');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Uspeh',
        description: `Pozivnica sa kredencijalima je poslata na ${email}`
      });
    } catch (error) {
      handleError({ 
        category: 'auth', 
        entity: 'korisnik', 
        error,
        customMessage: getErrorMessage(error)
      });
      throw error;
    }
  };

  const resetUserPassword = async (userId: string, newPassword: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { userId, newPassword }
      });

      if (error) {
        throw new Error(error.message || 'Nije moguće resetovati lozinku');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Uspeh',
        description: 'Lozinka je uspešno resetovana'
      });

      return true;
    } catch (error) {
      handleError({ 
        category: 'update', 
        entity: 'korisnik', 
        error,
        customMessage: getErrorMessage(error)
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
    sendInvitationWithCredentials,
    resetUserPassword,
    refetch: fetchUsers
  };
}

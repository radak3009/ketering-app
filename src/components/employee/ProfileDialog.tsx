import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Separator } from '@/components/ui/separator';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function ProfileDialog({ open, onOpenChange, user }: ProfileDialogProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && user) {
      fetchProfile();
      // Reset password fields when dialog opens
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open, user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    if (data) {
      setFullName(data.full_name || '');
      setPhone(data.phone || '');
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone
      })
      .eq('user_id', user.id);

    setLoading(false);

    if (error) {
      toast({
        title: 'Greška',
        description: 'Nije moguće sačuvati promene',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Uspešno',
      description: 'Profil je ažuriran',
    });

    onOpenChange(false);
  };

  const handlePasswordChange = async () => {
    if (!newPassword) {
      toast({
        title: 'Greška',
        description: 'Unesite novu lozinku',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Greška',
        description: 'Lozinka mora imati najmanje 6 karaktera',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Greška',
        description: 'Lozinke se ne podudaraju',
        variant: 'destructive',
      });
      return;
    }

    setPasswordLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    setPasswordLoading(false);

    if (error) {
      toast({
        title: 'Greška',
        description: error.message || 'Nije moguće promeniti lozinku',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Uspešno',
      description: 'Lozinka je promenjena',
    });

    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Moj profil</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Ime i prezime</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Unesite ime i prezime"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Broj telefona</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Unesite broj telefona"
            />
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Promena lozinke</h3>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova lozinka</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Unesite novu lozinku (min 6 karaktera)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Potvrdi lozinku</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Potvrdite novu lozinku"
              />
            </div>
            <Button 
              onClick={handlePasswordChange} 
              disabled={passwordLoading || !newPassword || !confirmPassword}
              className="w-full"
              variant="secondary"
            >
              {passwordLoading ? 'Menjam...' : 'Promeni lozinku'}
            </Button>
          </div>
        </div>

        <Separator className="my-2" />
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Čuvanje...' : 'Sačuvaj'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

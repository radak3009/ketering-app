import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EnhancedDatePicker } from '@/components/ui/enhanced-date-picker';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Loader2, User as UserIcon, Lock, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ProfileViewProps {
  user: User | null;
}

export function ProfileView({ user }: ProfileViewProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyCardId, setCompanyCardId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    setFetching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone, company_card_id, date_of_birth')
      .eq('user_id', user.id)
      .single();

    setFetching(false);

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    if (data) {
      setFullName(data.full_name || '');
      setPhone(data.phone || '');
      setCompanyCardId(data.company_card_id || '');
      setDateOfBirth(data.date_of_birth ? new Date(data.date_of_birth) : undefined);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone,
        date_of_birth: dateOfBirth ? format(dateOfBirth, 'yyyy-MM-dd') : null
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

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setPasswordLoading(false);

    if (error) {
      toast({
        title: 'Greška',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Uspešno',
      description: 'Lozinka je uspešno promenjena',
    });
    
    setNewPassword('');
    setConfirmPassword('');
  };

  if (fetching) {
    return (
      <Card>
        <CardContent className="py-12">
          <LoadingSpinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-24 sm:mb-0">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <UserIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Moj profil</CardTitle>
            <CardDescription>Upravljajte svojim profilom i informacijama</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email adresa se ne može promeniti
            </p>
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

          <div className="space-y-2">
            <Label>ID</Label>
            <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
              {companyCardId || (
                <span className="text-muted-foreground">Nema dodeljenog ID-a</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Vaš identifikacioni broj. Kontaktirajte administratora za izmenu.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Datum rođenja</Label>
            <EnhancedDatePicker
              date={dateOfBirth}
              onDateChange={setDateOfBirth}
              disabled={(date) =>
                date > new Date() || date < new Date("1900-01-01")
              }
              placeholder="Izaberite datum"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Čuvanje...' : 'Sačuvaj promene'}
            </Button>
          </div>

          <Separator className="my-6" />

          {/* Password Change Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Promena lozinke</h3>
                <p className="text-sm text-muted-foreground">Ažurirajte lozinku za pristup aplikaciji</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova lozinka</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Unesite novu lozinku"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Potvrdi lozinku</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ponovite novu lozinku"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Lozinka mora imati najmanje 6 karaktera
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button 
                onClick={handlePasswordChange} 
                disabled={passwordLoading} 
                variant="outline"
                className="gap-2"
              >
                {passwordLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {passwordLoading ? 'Menjanje...' : 'Promeni lozinku'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Loader2, User as UserIcon, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ProfileViewProps {
  user: User | null;
}

export function ProfileView({ user }: ProfileViewProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
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
      .select('full_name, phone, date_of_birth')
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

  if (fetching) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
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
            <Label>Datum rođenja</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateOfBirth && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateOfBirth ? format(dateOfBirth, "dd.MM.yyyy") : <span>Izaberite datum</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateOfBirth}
                  onSelect={setDateOfBirth}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Čuvanje...' : 'Sačuvaj promene'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

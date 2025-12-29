import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        title: t('toast.error'),
        description: t('toast.profileUpdateError'),
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: t('toast.success'),
      description: t('toast.profileUpdated'),
    });
  };

  const handlePasswordChange = async () => {
    if (!newPassword) {
      toast({
        title: t('toast.error'),
        description: t('profile.enterNewPassword'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('toast.error'),
        description: t('profile.passwordMinLength'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: t('toast.error'),
        description: t('profile.passwordMismatch'),
        variant: 'destructive',
      });
      return;
    }

    setPasswordLoading(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setPasswordLoading(false);

    if (error) {
      toast({
        title: t('toast.error'),
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: t('toast.success'),
      description: t('toast.passwordChanged'),
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
            <CardTitle>{t('profile.title')}</CardTitle>
            <CardDescription>{t('profile.description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">{t('profile.email')}</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              {t('profile.emailCannotChange')}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fullName">{t('profile.fullName')}</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('profile.fullNamePlaceholder')}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">{t('profile.phone')}</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('profile.phonePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('profile.companyCardId')}</Label>
            <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
              {companyCardId || (
                <span className="text-muted-foreground">{t('profile.noCardId')}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('profile.cardIdHelp')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('profile.dateOfBirth')}</Label>
            <EnhancedDatePicker
              date={dateOfBirth}
              onDateChange={setDateOfBirth}
              disabled={(date) =>
                date > new Date() || date < new Date("1900-01-01")
              }
              placeholder={t('profile.dateOfBirthPlaceholder')}
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t('common.saving') : t('common.saveChanges')}
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
                <h3 className="font-semibold">{t('profile.changePassword')}</h3>
                <p className="text-sm text-muted-foreground">{t('profile.changePasswordDescription')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('profile.newPasswordPlaceholder')}
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
              <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('profile.confirmPasswordPlaceholder')}
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
                {t('profile.passwordMinLength')}
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
                {passwordLoading ? t('common.changing') : t('profile.changePasswordButton')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

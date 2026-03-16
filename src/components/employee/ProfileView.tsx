import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EnhancedDatePicker } from '@/components/ui/enhanced-date-picker';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { User } from '@supabase/supabase-js';
import { Loader2, User as UserIcon, Lock, Eye, EyeOff, AlertTriangle, CheckCircle2, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { NotificationSettings } from './NotificationSettings';
import { AppVersionBadge } from '@/components/AppVersionBadge';

interface ProfileViewProps {
  user: User | null;
  isIdSetupMode?: boolean;
}

export function ProfileView({ user, isIdSetupMode = false }: ProfileViewProps) {
  const { t } = useTranslation();
  const { refreshProfile } = useAuth();
  const { getSetting, isLoading: settingsLoading } = useAppSettings();
  const tagVisibility = (getSetting('tag_selection_visible') as Record<string, boolean> | null) || {};
  const visibleTags = Object.entries(tagVisibility).filter(([, v]) => v === true).map(([k]) => k);
  const tagSelectionVisible = visibleTags.length > 0;
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyCardId, setCompanyCardId] = useState('');
  const [currentTag, setCurrentTag] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // ID setup state
  const [idInput, setIdInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [idError, setIdError] = useState('');
  const [idLoading, setIdLoading] = useState(false);
  const idSectionRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to ID setup section
  useEffect(() => {
    if (isIdSetupMode && idSectionRef.current && !fetching) {
      setTimeout(() => {
        idSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [isIdSetupMode, fetching]);

  const fetchProfile = async () => {
    if (!user) return;

    setFetching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone, company_card_id, tag, date_of_birth')
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
      setCurrentTag(data.tag || '');
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

  // Handle ID input change - only allow digits, max 10
  const handleIdInputChange = (value: string) => {
    if (value && !/^[0-9]*$/.test(value)) return;
    if (value.length > 10) return;
    setIdInput(value);
    setIdError('');
  };

  // Save company card ID and tag
  const handleSaveId = async () => {
    if (!user || !idInput) return;

    if (!/^[0-9]+$/.test(idInput)) {
      setIdError(t('profile.idMustBeNumeric', 'ID mora biti numerička vrednost'));
      return;
    }

    // Validate tag if visible
    if (tagSelectionVisible && !tagInput) {
      setIdError(t('profile.organizationRequired', 'Morate odabrati organizacionu jedinicu'));
      return;
    }

    setIdLoading(true);
    setIdError('');

    // Check uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_card_id', idInput)
      .maybeSingle();

    if (existing) {
      setIdError(t('profile.idAlreadyExists', { id: idInput, defaultValue: `ID ${idInput} je već dodeljen drugom korisniku` }));
      setIdLoading(false);
      return;
    }

    // Save ID + tag
    const updateData: any = { company_card_id: idInput };
    if (tagSelectionVisible && tagInput) {
      updateData.tag = tagInput;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', user.id);

    setIdLoading(false);

    if (error) {
      if (error.code === '23505') {
        setIdError(t('profile.idAlreadyExists', { id: idInput, defaultValue: `ID ${idInput} je već dodeljen drugom korisniku` }));
      } else {
        toast({
          title: t('toast.error'),
          description: t('toast.profileUpdateError'),
          variant: 'destructive',
        });
      }
      return;
    }

    toast({
      title: t('toast.success'),
      description: t('profile.idSetSuccess'),
    });

    await refreshProfile();
  };

  const handlePasswordChange = async () => {
    if (!user) return;

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

    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });

    if (authError) {
      setPasswordLoading(false);
      toast({
        title: t('toast.error'),
        description: authError.message,
        variant: 'destructive',
      });
      return;
    }

    setPasswordLoading(false);

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

  // Whether the ID field should be read-only (already set)
  const idIsReadOnly = !!companyCardId;
  // Whether the name needs to be set during onboarding
  const needsNameSetup = isIdSetupMode && !fullName;

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
          {/* ID Setup Mode Alert */}
          {isIdSetupMode && (
            <Alert className="border-destructive bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive font-medium">
                {t('profile.idSetupRequired')}
              </AlertDescription>
            </Alert>
          )}

          {/* ID Setup Section - prominent when in setup mode */}
          {isIdSetupMode && (
            <div 
              ref={idSectionRef}
              className="space-y-4 p-4 rounded-lg bg-primary/5 border-2 border-primary ring-2 ring-primary/20"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary">
                  <CreditCard className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('profile.setupId')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('profile.setupIdDescription')}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="idSetup">{t('profile.companyCardId')}</Label>
                <Input
                  id="idSetup"
                  value={idInput}
                  onChange={(e) => handleIdInputChange(e.target.value)}
                  placeholder={t('profile.enterCompanyCardId')}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  autoFocus
                  className={idError ? 'border-destructive' : ''}
                />
                {idError && (
                  <p className="text-sm text-destructive">{idError}</p>
                )}
              </div>

              {/* Separator between ID and Organization */}
              {(settingsLoading || tagSelectionVisible) && (
                <Separator className="my-2" />
              )}

              {/* Tag / Organization selection */}
              {settingsLoading ? (
                <div className="space-y-3">
                  <Label>{t('profile.selectOrganization', 'Odaberite organizacionu jedinicu')}</Label>
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{t('common.loading', 'Učitavanje...')}</span>
                  </div>
                </div>
              ) : tagSelectionVisible ? (
                <div className="space-y-3">
                  <Label>{t('profile.selectOrganization', 'Odaberite organizacionu jedinicu')}</Label>
                  <RadioGroup value={tagInput} onValueChange={setTagInput}>
                    {visibleTags.map((tag) => (
                      <div key={tag} className="flex items-center space-x-2">
                        <RadioGroupItem value={tag} id={`tag-${tag.toLowerCase()}`} />
                        <Label htmlFor={`tag-${tag.toLowerCase()}`} className="cursor-pointer">{tag}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ) : null}

              <div className="flex justify-end pt-2">
                <Button 
                  onClick={handleSaveId} 
                  disabled={idLoading || !idInput || (tagSelectionVisible && !tagInput)} 
                  size="lg"
                  className="gap-2"
                >
                  {idLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {idLoading ? t('common.saving') : t('profile.saveId')}
                </Button>
              </div>
            </div>
          )}

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
              disabled={isIdSetupMode}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">{t('profile.phone')}</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('profile.phonePlaceholder')}
              disabled={isIdSetupMode}
            />
          </div>

          {/* Company Card ID - read-only when already set, hidden in setup mode (shown above) */}
          {!isIdSetupMode && (
            <div className="space-y-2">
              <Label>{t('profile.companyCardId')}</Label>
              <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
                {companyCardId || (
                  <span className="text-muted-foreground">{t('profile.noCardId')}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {idIsReadOnly ? t('profile.idReadOnlyHelp') : t('profile.cardIdHelp')}
              </p>
            </div>
          )}

          {/* Organization / Tag - read-only when already set, hidden in setup mode */}
          {!isIdSetupMode && (
            <div className="space-y-2">
              <Label>{t('profile.organization', 'Organizacija')}</Label>
              <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
                {currentTag || (
                  <span className="text-muted-foreground">{t('profile.noOrganization', 'Nije definisano')}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {currentTag 
                  ? t('profile.organizationReadOnlyHelp', 'Organizacija je trajno dodeljena. Kontaktirajte administratora za promenu.')
                  : t('profile.organizationHelp', 'Kontaktirajte administratora za dodelu organizacije.')}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('profile.dateOfBirth')}</Label>
            <EnhancedDatePicker
              date={dateOfBirth}
              onDateChange={setDateOfBirth}
              disabled={(date) =>
                date > new Date() || date < new Date("1900-01-01") || isIdSetupMode
              }
              placeholder={t('profile.dateOfBirthPlaceholder')}
            />
          </div>

          {!isIdSetupMode && (
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={loading} className="gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </div>
          )}

          {!isIdSetupMode && (
            <>
              <Separator className="my-6" />

              {/* Password Change Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{t('profile.changePassword')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('profile.changePasswordDescription')}
                    </p>
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

              <Separator className="my-6" />
              <NotificationSettings />
            </>
          )}

          <AppVersionBadge />
        </div>
      </CardContent>
    </Card>
  );
}

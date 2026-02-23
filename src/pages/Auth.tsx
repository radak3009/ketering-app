import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, Lock, User, KeyRound, IdCard, Info } from 'lucide-react';
import { z } from 'zod';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const { t } = useTranslation();
  const { signUp, signIn, signInWithGoogle, signInWithMagicLink, signOut, resetPassword, updatePassword, user, profile, loading: authLoading, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingAuth, setProcessingAuth] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [passwordResetData, setPasswordResetData] = useState({
    password: '',
    confirmPassword: ''
  });
  
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  
  const [signInData, setSignInData] = useState({
    identifier: '',
    password: ''
  });

  const [magicLinkEmail, setMagicLinkEmail] = useState('');

  // Dynamic validation schemas with translations
  const signUpSchema = z.object({
    email: z.string().email(t('auth.validation.invalidEmail')).max(255),
    password: z.string().min(6, t('auth.validation.passwordMin')).max(100),
    fullName: z.string().trim().min(2, t('auth.validation.nameMin')).max(100)
  });

  const signInSchema = z.object({
    identifier: z.string().min(1, t('auth.validation.enterPassword')).max(255),
    password: z.string().min(1, t('auth.validation.enterPassword')).max(100)
  });

  const magicLinkSchema = z.object({
    email: z.string().email(t('auth.validation.invalidEmail')).max(255)
  });

  const passwordResetSchema = z.object({
    password: z.string().min(6, t('auth.validation.passwordMin')).max(100),
    confirmPassword: z.string().min(6, t('auth.validation.confirmPasswordMin')).max(100)
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('auth.validation.passwordsNotMatch'),
    path: ["confirmPassword"]
  });

  useEffect(() => {
    const recoveryParam = searchParams.get('recovery') === 'true';
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const recoveryFromHash = hashParams.get('type') === 'recovery';
    
    if (recoveryParam || recoveryFromHash || isPasswordRecovery) {
      console.log('[Auth] Recovery mode detected:', { recoveryParam, recoveryFromHash, isPasswordRecovery });
      setIsRecoveryMode(true);
    }
  }, [searchParams, isPasswordRecovery]);

  useEffect(() => {
    if (isRecoveryMode) {
      return;
    }
    
    if (user && !profile && !authLoading) {
      setProcessingAuth(true);
    }
    
    if (user && profile) {
      setProcessingAuth(false);
      navigate('/');
    }
    
    if (!user) {
      setProcessingAuth(false);
    }
  }, [user, profile, navigate, authLoading, isRecoveryMode]);

  // Read tag from URL
  const tagFromUrl = searchParams.get('tag');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = signUpSchema.parse(signUpData);
      setLoading(true);
      
      const { error } = await signUp(
        validatedData.email,
        validatedData.password,
        validatedData.fullName,
        'employee',
        tagFromUrl || undefined
      );
      
      if (error) {
        if (error.message.includes('User already registered')) {
          toast({
            title: t('auth.errors.error'),
            description: t('auth.errors.userExists'),
            variant: 'destructive'
          });
        } else {
          toast({
            title: t('auth.errors.registrationError'),
            description: error.message,
            variant: 'destructive'
          });
        }
      } else {
        toast({
          title: t('auth.success.registrationSuccess'),
          description: t('auth.success.checkEmailConfirm'),
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t('auth.errors.dataError'),
          description: error.errors[0].message,
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = signInSchema.parse(signInData);
      setLoading(true);
      
      const isEmail = validatedData.identifier.includes('@');
      
      if (isEmail) {
        // Direct Supabase auth for email
        const { error } = await signIn(validatedData.identifier, validatedData.password);
        
        if (error) {
          handleSignInError(error);
        }
      } else {
        // Edge Function lookup for company_card_id
        const { data, error } = await supabase.functions.invoke('login-with-id', {
          body: { 
            identifier: validatedData.identifier, 
            password: validatedData.password 
          }
        });
        
        if (error) {
          toast({
            title: t('auth.errors.loginFailed'),
            description: t('auth.errors.invalidCredentials'),
            variant: 'destructive'
          });
        } else if (data?.error) {
          // Handle error from edge function
          if (data.retryAfter) {
            // Rate limit exceeded
            toast({
              title: t('auth.errors.loginFailed'),
              description: t('auth.errors.rateLimitExceeded', { seconds: data.retryAfter }),
              variant: 'destructive'
            });
          } else if (data.error.includes('nije pronađen') || data.error.includes('not found')) {
            toast({
              title: t('auth.errors.loginFailed'),
              description: t('auth.errors.userNotFoundById'),
              variant: 'destructive'
            });
          } else if (data.error.includes('lozinka') || data.error.includes('password')) {
            toast({
              title: t('auth.errors.loginFailed'),
              description: t('auth.errors.invalidPassword'),
              variant: 'destructive'
            });
          } else {
            toast({
              title: t('auth.errors.loginFailed'),
              description: data.error,
              variant: 'destructive'
            });
          }
        } else if (data?.session) {
          // Set the session from edge function response
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          });
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t('auth.errors.dataError'),
          description: error.errors[0].message,
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignInError = (error: { message: string }) => {
    if (error.message.includes('Invalid login credentials')) {
      toast({
        title: t('auth.errors.loginFailed'),
        description: t('auth.errors.invalidCredentials'),
        variant: 'destructive'
      });
    } else if (error.message.includes('Email not confirmed')) {
      toast({
        title: t('auth.errors.emailNotConfirmed'),
        description: t('auth.errors.confirmEmail'),
        variant: 'destructive'
      });
    } else {
      toast({
        title: t('auth.errors.loginError'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: t('auth.errors.error'),
        description: t('auth.errors.googleLoginFailed'),
        variant: 'destructive'
      });
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = magicLinkSchema.parse({ email: magicLinkEmail });
      setLoading(true);
      
      const { error } = await signInWithMagicLink(validatedData.email);
      
      if (error) {
        toast({
          title: t('auth.errors.error'),
          description: error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: t('auth.success.magicLinkSent'),
          description: t('auth.success.magicLinkDesc'),
        });
        setMagicLinkEmail('');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t('auth.errors.dataError'),
          description: error.errors[0].message,
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = magicLinkSchema.parse({ email: forgotPasswordEmail });
      setLoading(true);
      
      const { error } = await resetPassword(validatedData.email);
      
      if (error) {
        toast({
          title: t('auth.errors.error'),
          description: error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: t('auth.success.emailSent'),
          description: t('auth.success.checkEmailReset'),
        });
        setForgotPasswordEmail('');
        setShowForgotPassword(false);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t('auth.errors.dataError'),
          description: error.errors[0].message,
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = passwordResetSchema.parse(passwordResetData);
      setLoading(true);
      
      const { error } = await updatePassword(validatedData.password);
      
      if (error) {
        toast({
          title: t('auth.errors.error'),
          description: error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: t('auth.success.passwordSet'),
          description: t('auth.success.canLoginNow'),
        });
        setIsRecoveryMode(false);
        clearPasswordRecovery();
        setPasswordResetData({ password: '', confirmPassword: '' });
        navigate('/auth', { replace: true });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t('auth.errors.dataError'),
          description: error.errors[0].message,
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading spinner while profile loads
  if (!isRecoveryMode && user && !profile && (authLoading || processingAuth)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center relative">
        <div className="absolute top-4 right-4">
          <LanguageToggle />
        </div>
        <LoadingSpinner size="xl" text={t('auth.loadingProfile')} />
      </div>
    );
  }

  // Password reset form in recovery mode
  if (isRecoveryMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4">
          <LanguageToggle />
        </div>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">{t('auth.portalTitle')}</h1>
            <p className="text-muted-foreground">{t('auth.setNewPassword')}</p>
          </div>

          <Card className="shadow-elegant border-primary/20">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
                <KeyRound className="h-6 w-6" />
                {t('auth.newPasswordTitle')}
              </CardTitle>
              <CardDescription className="text-center">
                {t('auth.enterNewPasswordDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t('auth.newPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('auth.minCharsPlaceholder')}
                      className="pl-10 pr-10"
                      value={passwordResetData.password}
                      onChange={(e) => setPasswordResetData({ ...passwordResetData, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t('auth.confirmPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('auth.repeatPassword')}
                      className="pl-10 pr-10"
                      value={passwordResetData.confirmPassword}
                      onChange={(e) => setPasswordResetData({ ...passwordResetData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('auth.settingPassword') : t('auth.setPassword')}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Button
                  variant="link"
                  className="text-sm text-muted-foreground"
                  onClick={() => {
                    setIsRecoveryMode(false);
                    clearPasswordRecovery();
                    navigate('/auth', { replace: true });
                  }}
                >
                  {t('auth.backToLogin')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Forgot password form
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4">
          <LanguageToggle />
        </div>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">{t('auth.portalTitle')}</h1>
            <p className="text-muted-foreground">{t('auth.resetPassword')}</p>
          </div>

          <Card className="shadow-elegant border-primary/20">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">{t('auth.forgotPasswordTitle')}</CardTitle>
              <CardDescription className="text-center">
                {t('auth.forgotPasswordDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">{t('auth.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                      id="forgot-email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      className="pl-10"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('auth.sending') : t('auth.sendResetLink')}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Button
                  variant="link"
                  className="text-sm text-muted-foreground"
                  onClick={() => setShowForgotPassword(false)}
                >
                  {t('auth.backToLogin')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('auth.portalTitle')}</h1>
          <p className="text-muted-foreground">{t('auth.loginToAccount')}</p>
        </div>

        {user && !authLoading && !profile && !processingAuth ? (
          <Card className="shadow-elegant border-destructive/20">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center text-destructive">{t('auth.profileNotCreated')}</CardTitle>
              <CardDescription className="text-center">
                {t('auth.profileNotCreatedDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => signOut()} 
                className="w-full"
                variant="outline"
              >
                {t('common.signOut')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-elegant border-primary/20">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">{t('auth.welcome')}</CardTitle>
              <CardDescription className="text-center">
                {t('auth.chooseAccess')}
              </CardDescription>
            </CardHeader>
            <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="signin">{t('auth.signIn')}</TabsTrigger>
                <TabsTrigger value="magiclink">{t('auth.magicLink')}</TabsTrigger>
                <TabsTrigger value="signup">{t('auth.register')}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-identifier">{t('auth.emailOrId')}</Label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-identifier"
                        type="text"
                        placeholder={t('auth.emailOrIdPlaceholder')}
                        className="pl-10"
                        value={signInData.identifier}
                        onChange={(e) => setSignInData({ ...signInData, identifier: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">{t('auth.password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t('auth.enterPassword')}
                        className="pl-10 pr-10"
                        value={signInData.password}
                        onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('auth.loggingIn') : t('auth.signIn')}
                  </Button>

                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-muted-foreground p-0 h-auto"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      {t('auth.forgotPassword')}
                    </Button>
                  </div>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t('auth.or')}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                >
                  {t('auth.signInWithGoogle')}
                </Button>
              </TabsContent>

              <TabsContent value="magiclink" className="space-y-4">
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-muted-foreground text-center">
                    {t('auth.magicLinkDesc')}
                  </p>
                </div>
                
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="magiclink-email">{t('auth.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="magiclink-email"
                        type="email"
                        placeholder={t('auth.emailPlaceholder')}
                        className="pl-10"
                        value={magicLinkEmail}
                        onChange={(e) => setMagicLinkEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('auth.sending') : t('auth.sendMagicLink')}
                  </Button>
                </form>

                <div className="text-center text-sm text-muted-foreground mt-4">
                  <p>{t('auth.linkExpires')}</p>
                </div>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                {tagFromUrl && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                    <Info className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>
                      {t('auth.registeringForTag')}: <strong>{tagFromUrl}</strong>
                    </span>
                  </div>
                )}
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">{t('auth.fullName')}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder={t('auth.namePlaceholder')}
                        className="pl-10"
                        value={signUpData.fullName}
                        onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t('auth.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder={t('auth.emailPlaceholder')}
                        className="pl-10"
                        value={signUpData.email}
                        onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t('auth.password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t('auth.minCharsPlaceholder')}
                        className="pl-10 pr-10"
                        value={signUpData.password}
                        onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('auth.registering') : t('auth.signUp')}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t('auth.or')}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {authLoading ? t('auth.connecting') : t('auth.registerWithGoogle')}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, Lock, User, Building2 } from 'lucide-react';
import { z } from 'zod';

const signUpSchema = z.object({
  email: z.string().email('Neispravna email adresa').max(255),
  password: z.string().min(6, 'Lozinka mora imati najmanje 6 karaktera').max(100),
  fullName: z.string().trim().min(2, 'Ime mora imati najmanje 2 karaktera').max(100),
  role: z.enum(['admin', 'employee'])
});

const signInSchema = z.object({
  email: z.string().email('Neispravna email adresa').max(255),
  password: z.string().min(1, 'Unesite lozinku').max(100)
});

export default function Auth() {
  const { signUp, signIn, signInWithGoogle, signOut, user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'employee' as 'admin' | 'employee'
  });
  
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    // Only redirect if user exists AND has profile
    if (user && profile) {
      navigate('/');
    }
  }, [user, profile, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = signUpSchema.parse(signUpData);
      setLoading(true);
      
      const { error } = await signUp(
        validatedData.email,
        validatedData.password,
        validatedData.fullName,
        validatedData.role
      );
      
      if (error) {
        if (error.message.includes('User already registered')) {
          toast({
            title: 'Greška',
            description: 'Korisnik sa ovom email adresom već postoji.',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Greška pri registraciji',
            description: error.message,
            variant: 'destructive'
          });
        }
      } else {
        toast({
          title: 'Uspešna registracija',
          description: 'Proverite email za potvrdu naloga.',
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Greška u podacima',
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
      
      const { error } = await signIn(validatedData.email, validatedData.password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Prijava neuspešna',
            description: 'Neispravni podaci za prijavljivanje. Ako nemate nalog, molimo vas kontaktirajte administratora za registraciju.',
            variant: 'destructive'
          });
        } else if (error.message.includes('Email not confirmed')) {
          toast({
            title: 'Email nije potvrđen',
            description: 'Molimo vas proverite email i potvrdite nalog.',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Greška pri prijavljivanju',
            description: error.message,
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Greška u podacima',
          description: error.errors[0].message,
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: 'Greška',
        description: 'Prijavljivanje sa Google nalogom nije uspelo.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Catering Portal</h1>
          <p className="text-muted-foreground">Prijavite se na vaš nalog</p>
        </div>

        {user && !authLoading && !profile ? (
          <Card className="shadow-elegant border-destructive/20">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center text-destructive">Profil nije kreiran</CardTitle>
              <CardDescription className="text-center">
                Vaš profil još uvek nije kreiran. Molimo vas kontaktirajte administratora ili se odjavite i registrujte ponovo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => signOut()} 
                className="w-full"
                variant="outline"
              >
                Odjavi se
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-elegant border-primary/20">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Dobrodošli</CardTitle>
              <CardDescription className="text-center">
                Izaberite kako želite da pristupite
              </CardDescription>
            </CardHeader>
            <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Prijavljivanje</TabsTrigger>
                <TabsTrigger value="signup">Registracija</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="vas@email.com"
                        className="pl-10"
                        value={signInData.email}
                        onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Lozinka</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Unesite lozinku"
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
                    {loading ? 'Prijavljivanje...' : 'Prijavite se'}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">ili</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                >
                  Prijavite se sa Google
                </Button>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Puno ime</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Marko Marković"
                        className="pl-10"
                        value={signUpData.fullName}
                        onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="vas@email.com"
                        className="pl-10"
                        value={signUpData.email}
                        onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Lozinka</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Najmanje 6 karaktera"
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-role">Uloga</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Select
                        value={signUpData.role}
                        onValueChange={(value: 'admin' | 'employee') => 
                          setSignUpData({ ...signUpData, role: value })
                        }
                      >
                        <SelectTrigger className="pl-10">
                          <SelectValue placeholder="Izaberite ulogu" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Zaposleni</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Registracija...' : 'Registrujte se'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
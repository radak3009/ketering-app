import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ExternalLink, MonitorSmartphone, ChefHat, QrCode, Clock, Users, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QRCodeSVG } from "qrcode.react";
import { KitchenScheduleSettings } from "./KitchenScheduleSettings";
import { AppVersionBadge } from "@/components/AppVersionBadge";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function SettingsTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { getSetting, updateSetting, isUpdating } = useAppSettings();
  const [allTags, setAllTags] = useState<string[]>([]);

  // Fetch all unique tags from profiles
  useEffect(() => {
    const fetchTags = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('tag')
        .not('tag', 'is', null)
        .neq('tag', '');
      const unique = [...new Set((data || []).map(p => p.tag).filter(Boolean))] as string[];
      unique.sort();
      setAllTags(unique);
    };
    fetchTags();
  }, []);

  // Kiosk tokens state - stored in localStorage for persistence
  const [employeeToken, setEmployeeToken] = useState(() => 
    localStorage.getItem('kiosk_employee_token') || ''
  );
  const [kitchenToken, setKitchenToken] = useState(() => 
    localStorage.getItem('kiosk_kitchen_token') || ''
  );

  const handleEmployeeTokenChange = (value: string) => {
    const sanitized = value.trim().slice(0, 100);
    setEmployeeToken(sanitized);
    localStorage.setItem('kiosk_employee_token', sanitized);
  };

  const handleKitchenTokenChange = (value: string) => {
    const sanitized = value.trim().slice(0, 100);
    setKitchenToken(sanitized);
    localStorage.setItem('kiosk_kitchen_token', sanitized);
  };

  const employeeKioskUrl = `/kiosk/pickup?t=${encodeURIComponent(employeeToken || 'YOUR_EMPLOYEE_TOKEN')}`;
  const kitchenKioskUrl = `/kiosk/kitchen?t=${encodeURIComponent(kitchenToken || 'YOUR_KITCHEN_TOKEN')}`;
  const employeeKioskUrlMasked = `/kiosk/pickup?t=••••••••`;
  const kitchenKioskUrlMasked = `/kiosk/kitchen?t=••••••••`;
  const hasValidTokens = employeeToken.length > 0 && kitchenToken.length > 0;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="kiosk" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="kiosk" className="gap-1.5">
            <MonitorSmartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Kiosk postavke</span>
            <span className="sm:hidden">Kiosk</span>
          </TabsTrigger>
          <TabsTrigger value="kitchen" className="gap-1.5">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Kuhinja</span>
            <span className="sm:hidden">Kuhinja</span>
          </TabsTrigger>
          <TabsTrigger value="organization" className="gap-1.5">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Organizacija</span>
            <span className="sm:hidden">Org.</span>
          </TabsTrigger>
        </TabsList>

        {/* Kiosk Tab */}
        <TabsContent value="kiosk">
          <Card>
            <CardHeader>
              <CardTitle>Kiosk paneli</CardTitle>
              <CardDescription>Pristup kiosk ekranima za preuzimanje obroka</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Token Input Section */}
              <div className="grid md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="employee-token" className="flex items-center gap-2">
                    <MonitorSmartphone className="h-4 w-4" />
                    Token za ulaz u kantinu
                  </Label>
                  <Input
                    id="employee-token"
                    type="password"
                    placeholder="Unesite KIOSK_TOKEN_EMPLOYEE"
                    value={employeeToken}
                    onChange={(e) => handleEmployeeTokenChange(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kitchen-token" className="flex items-center gap-2">
                    <ChefHat className="h-4 w-4" />
                    Token za kuhinju
                  </Label>
                  <Input
                    id="kitchen-token"
                    type="password"
                    placeholder="Unesite KIOSK_TOKEN_KITCHEN"
                    value={kitchenToken}
                    onChange={(e) => handleKitchenTokenChange(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                {!hasValidTokens && (
                  <p className="md:col-span-2 text-sm text-warning">
                    ⚠️ Unesite tokene iz Supabase secrets-a za generisanje ispravnih URL-ova
                  </p>
                )}
              </div>

              {/* Kiosk Links */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <MonitorSmartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Kiosk - Ulaz u kantinu</p>
                      <p className="text-sm text-muted-foreground">
                        Za zaposlene da prikažu današnji obrok
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={!employeeToken}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>QR Kod - Ulaz u kantinu</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-4 py-4">
                          <div className="p-4 bg-white rounded-lg">
                            <QRCodeSVG 
                              value={`${window.location.origin}${employeeKioskUrl}`}
                              size={200}
                              level="H"
                            />
                          </div>
                          <p className="text-sm text-muted-foreground text-center">
                            Skenirajte ovaj QR kod na tabletu za pristup kiosku
                          </p>
                          <code className="text-xs bg-muted p-2 rounded break-all max-w-full">
                            {`${window.location.origin}${employeeKioskUrlMasked}`}
                          </code>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" asChild disabled={!employeeToken}>
                      <a href={employeeKioskUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Otvori
                      </a>
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10">
                      <ChefHat className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">Kiosk - Kuhinja</p>
                      <p className="text-sm text-muted-foreground">
                        Za kuhinjsko osoblje da izdaju obroke
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={!kitchenToken}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>QR Kod - Kuhinja</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-4 py-4">
                          <div className="p-4 bg-white rounded-lg">
                            <QRCodeSVG 
                              value={`${window.location.origin}${kitchenKioskUrl}`}
                              size={200}
                              level="H"
                            />
                          </div>
                          <p className="text-sm text-muted-foreground text-center">
                            Skenirajte ovaj QR kod na tabletu za pristup kiosku
                          </p>
                          <code className="text-xs bg-muted p-2 rounded break-all max-w-full">
                            {`${window.location.origin}${kitchenKioskUrlMasked}`}
                          </code>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" asChild disabled={!kitchenToken}>
                      <a href={kitchenKioskUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Otvori
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                💡 <strong>Napomena:</strong> Tokeni se čuvaju lokalno u vašem pregledaču. 
                Preuzmite tokene iz Supabase Edge Function secrets-a. 
                Koristite Full Screen (F11) za kiosk mod na tabletima.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kitchen Tab */}
        <TabsContent value="kitchen">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Radno vreme kuhinje
              </CardTitle>
              <CardDescription>
                Podešavanje radnog vremena i izuzetaka za kiosk sistem
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KitchenScheduleSettings />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('settings.employeeSettings', 'Podešavanje organizacije')}
              </CardTitle>
              <CardDescription>
                {t('settings.employeeSettingsDesc', 'Konfigurisanje opcija vidljivih zaposlenima')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label className="text-base">{t('settings.tagSelectionVisible', 'Organizaciona jedinica (Tag)')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.tagSelectionVisibleDesc', 'Prikažite opciju za odabir organizacione jedinice zaposlenima prilikom registracije')}
              </p>
              {allTags.map((tag) => {
                const tagVisibility = (getSetting('tag_selection_visible') as Record<string, boolean> | null) || {};
                const isVisible = tagVisibility[tag] === true;
                return (
                  <div key={tag} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base">{tag}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isVisible}
                        disabled={isUpdating}
                        onCheckedChange={async (checked) => {
                          try {
                            const current = (getSetting('tag_selection_visible') as Record<string, boolean> | null) || {};
                            await updateSetting({ key: 'tag_selection_visible', value: { ...current, [tag]: checked } });
                            toast({ title: t('toast.success'), description: t('toast.profileUpdated') });
                          } catch {
                            toast({ title: t('toast.error'), description: t('toast.errorOccurred'), variant: 'destructive' });
                          }
                        }}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Obrisati tag "{tag}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tag će biti uklonjen sa svih korisnika koji ga trenutno imaju i iz podešavanja vidljivosti. Ova akcija se ne može poništiti.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Otkaži</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={async () => {
                                try {
                                  await supabase
                                    .from('profiles')
                                    .update({ tag: null })
                                    .eq('tag', tag);

                                  const current = (getSetting('tag_selection_visible') as Record<string, boolean> | null) || {};
                                  const { [tag]: _, ...rest } = current;
                                  await updateSetting({ key: 'tag_selection_visible', value: rest });

                                  setAllTags(prev => prev.filter(t => t !== tag));
                                  toast({ title: 'Uspeh', description: `Tag "${tag}" je obrisan` });
                                } catch {
                                  toast({ title: t('toast.error'), description: t('toast.errorOccurred'), variant: 'destructive' });
                                }
                              }}
                            >
                              Obriši
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AppVersionBadge />
    </div>
  );
}

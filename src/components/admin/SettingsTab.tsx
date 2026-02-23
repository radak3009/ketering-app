import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ExternalLink, MonitorSmartphone, ChefHat, QrCode, Clock, Tag, Copy, Plus, Trash2, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { KitchenScheduleSettings } from "./KitchenScheduleSettings";
import { useToast } from "@/hooks/use-toast";

export function SettingsTab() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Tag-based registration links
  const [tags, setTags] = useState<string[]>(() => {
    const saved = localStorage.getItem('registration_tags');
    return saved ? JSON.parse(saved) : ['Proizvodnja', 'Hogo'];
  });
  const [newTag, setNewTag] = useState('');

  const addTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      const updated = [...tags, trimmed];
      setTags(updated);
      localStorage.setItem('registration_tags', JSON.stringify(updated));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    const updated = tags.filter(t => t !== tag);
    setTags(updated);
    localStorage.setItem('registration_tags', JSON.stringify(updated));
  };

  const getRegistrationUrl = (tag: string) => 
    `${window.location.origin}/auth?tag=${encodeURIComponent(tag)}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Kopirano!", description: "Link je kopiran u clipboard." });
  };

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

  // Generate kiosk URLs with tokens
  const employeeKioskUrl = `/kiosk/pickup?t=${encodeURIComponent(employeeToken || 'YOUR_EMPLOYEE_TOKEN')}`;
  const kitchenKioskUrl = `/kiosk/kitchen?t=${encodeURIComponent(kitchenToken || 'YOUR_KITCHEN_TOKEN')}`;
  
  // Masked URLs for display (hide token value)
  const employeeKioskUrlMasked = `/kiosk/pickup?t=••••••••`;
  const kitchenKioskUrlMasked = `/kiosk/kitchen?t=••••••••`;
  
  const hasValidTokens = employeeToken.length > 0 && kitchenToken.length > 0;

  return (
    <div className="grid gap-6">
      {/* Kiosk Panels Card */}
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

      {/* Tag Registration QR Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Registracijski linkovi po grupama
          </CardTitle>
          <CardDescription>
            Generišite QR kodove za registraciju zaposlenih sa automatskim dodeljivanjem grupe (TAG)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Naziv nove grupe (npr. Marketing)"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              className="flex-1"
            />
            <Button onClick={addTag} size="sm" disabled={!newTag.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Dodaj
            </Button>
          </div>

          <div className="grid gap-3">
            {tags.map((tag) => (
              <div key={tag} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Tag className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{tag}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-[400px]">
                      {getRegistrationUrl(tag)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(getRegistrationUrl(tag))}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>QR Kod - {tag}</DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-col items-center gap-4 py-4">
                        <div className="p-4 bg-white rounded-lg">
                          <QRCodeSVG 
                            value={getRegistrationUrl(tag)}
                            size={200}
                            level="H"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground text-center">
                          Skenirajte za registraciju u grupu <strong>{tag}</strong>
                        </p>
                        <code className="text-xs bg-muted p-2 rounded break-all max-w-full">
                          {getRegistrationUrl(tag)}
                        </code>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" onClick={() => removeTag(tag)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {tags.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nema definisanih grupa. Dodajte prvu grupu iznad.
            </p>
          )}

          <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
            💡 <strong>Napomena:</strong> Kada se korisnik registruje preko ovih linkova, 
            TAG grupa se automatski dodeljuje njihovom profilu. Možete dodati neograničen broj grupa.
          </div>
        </CardContent>
      </Card>

      {/* Kitchen Schedule Settings */}
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
    </div>
  );
}

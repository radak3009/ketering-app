import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Mail, Key, Loader2, Send } from 'lucide-react';
import type { ProfileWithRole } from '@/types';

type InvitationType = 'credentials' | 'magic-link';

interface SendInvitationDialogProps {
  user: ProfileWithRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMagicLink: (email: string, fullName?: string) => Promise<void>;
  onSendCredentials: (userId: string, email: string, fullName?: string) => Promise<void>;
}

export function SendInvitationDialog({
  user,
  open,
  onOpenChange,
  onSendMagicLink,
  onSendCredentials,
}: SendInvitationDialogProps) {
  const [inviteType, setInviteType] = useState<InvitationType>('credentials');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!user?.email) return;

    setLoading(true);
    try {
      if (inviteType === 'credentials') {
        await onSendCredentials(user.user_id, user.email, user.full_name || undefined);
      } else {
        await onSendMagicLink(user.email, user.full_name || undefined);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending invitation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!loading) {
      onOpenChange(newOpen);
      // Reset to default when closing
      if (!newOpen) {
        setInviteType('credentials');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pošalji pozivnicu
          </DialogTitle>
          <DialogDescription>
            Izaberite način slanja pozivnice za <strong>{user?.full_name || user?.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={inviteType}
            onValueChange={(value) => setInviteType(value as InvitationType)}
            className="space-y-4"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
              <RadioGroupItem value="credentials" id="credentials" className="mt-1" />
              <Label htmlFor="credentials" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-medium">
                  <Key className="h-4 w-4 text-primary" />
                  Pozivni email sa kredencijalima
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Korisnik dobija email sa novom privremenom lozinkom koju može koristiti za prijavu
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
              <RadioGroupItem value="magic-link" id="magic-link" className="mt-1" />
              <Label htmlFor="magic-link" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4 text-primary" />
                  Pozivni email sa Magičnim linkom
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Korisnik se prijavljuje jednim klikom na link u emailu, bez lozinke
                </p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Otkaži
          </Button>
          <Button onClick={handleSend} disabled={loading || !user?.email}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Pošalji pozivnicu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

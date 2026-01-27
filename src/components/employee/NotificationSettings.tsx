import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { Bell, Mail, Smartphone, AlertTriangle } from 'lucide-react';

export function NotificationSettings() {
  const { t } = useTranslation();
  const {
    preferences,
    loading,
    saving,
    pushSupported,
    pushPermission,
    updatePreferences,
  } = useNotificationPreferences();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <LoadingSpinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>{t('notifications.title')}</CardTitle>
            <CardDescription>{t('notifications.description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <Label htmlFor="email-notifications" className="text-base font-medium">
                {t('notifications.emailNotifications')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('notifications.emailDescription')}
              </p>
            </div>
          </div>
          <Switch
            id="email-notifications"
            checked={preferences.email_enabled}
            onCheckedChange={(checked) => updatePreferences({ email_enabled: checked })}
            disabled={saving}
          />
        </div>

        {/* Push notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <Label htmlFor="push-notifications" className="text-base font-medium">
                {t('notifications.pushNotifications')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('notifications.pushDescription')}
              </p>
            </div>
          </div>
          <Switch
            id="push-notifications"
            checked={preferences.push_enabled}
            onCheckedChange={(checked) => updatePreferences({ push_enabled: checked })}
            disabled={saving || !pushSupported}
          />
        </div>

        {/* Push not supported warning */}
        {!pushSupported && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('notifications.pushNotSupported')}
            </AlertDescription>
          </Alert>
        )}

        {/* Permission denied warning */}
        {pushSupported && pushPermission === 'denied' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('notifications.pushBlocked')}
            </AlertDescription>
          </Alert>
        )}

        {/* Schedule info */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {t('notifications.scheduleInfo')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

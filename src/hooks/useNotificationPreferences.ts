import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
}

// VAPID public key - must match the one in edge function
const VAPID_PUBLIC_KEY = 'BNKb8nIjIjGqHzGdCRrpEYeDvS7G9KsLc_8aVgqnKvRgDvNGcONxPvNdHTfDPfNbGKpMz3Kj6XmHGLrqcLGHiAs';

export function useNotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_enabled: true,
    push_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setPushSupported(supported);
    
    if (supported) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // Fetch preferences
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPreferences = async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('email_enabled, push_enabled')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching notification preferences:', error);
      }

      if (data) {
        setPreferences({
          email_enabled: data.email_enabled,
          push_enabled: data.push_enabled,
        });
      }

      setLoading(false);
    };

    fetchPreferences();
  }, [user]);

  const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer as ArrayBuffer;
  };

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!pushSupported || !user) return false;

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission !== 'granted') {
        toast({
          title: t('notifications.permissionDenied'),
          description: t('notifications.enableInBrowser'),
          variant: 'destructive',
        });
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subscriptionJSON = subscription.toJSON();

      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscriptionJSON.keys?.p256dh || '',
          auth: subscriptionJSON.keys?.auth || '',
        }, {
          onConflict: 'user_id,endpoint',
        });

      if (error) {
        console.error('Error saving push subscription:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      return false;
    }
  }, [pushSupported, user, toast, t]);

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!pushSupported || !user) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);

        if (error) {
          console.error('Error removing push subscription:', error);
        }
      }

      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      return false;
    }
  }, [pushSupported, user]);

  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    if (!user) return;

    setSaving(true);

    const updatedPreferences = { ...preferences, ...newPreferences };

    // Handle push subscription
    if (newPreferences.push_enabled !== undefined) {
      if (newPreferences.push_enabled) {
        const success = await subscribeToPush();
        if (!success) {
          setSaving(false);
          return;
        }
      } else {
        await unsubscribeFromPush();
      }
    }

    // Upsert preferences
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        ...updatedPreferences,
      }, {
        onConflict: 'user_id',
      });

    setSaving(false);

    if (error) {
      console.error('Error updating notification preferences:', error);
      toast({
        title: t('toast.error'),
        description: t('notifications.updateError'),
        variant: 'destructive',
      });
      return;
    }

    setPreferences(updatedPreferences);
    toast({
      title: t('toast.success'),
      description: t('notifications.preferencesUpdated'),
    });
  }, [user, preferences, subscribeToPush, unsubscribeFromPush, toast, t]);

  return {
    preferences,
    loading,
    saving,
    pushSupported,
    pushPermission,
    updatePreferences,
  };
}

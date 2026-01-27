import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { kioskApi } from "@/services/kioskApi";
import type { QueueItem } from "@/types/kiosk";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

interface UseKioskRealtimeOptions {
  token: string;
  onAuthError?: () => void;
}

interface UseKioskRealtimeReturn {
  pending: QueueItem[];
  served: QueueItem[];
  loading: boolean;
  connectionStatus: ConnectionStatus;
  lastUpdate: Date | null;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  setPending: React.Dispatch<React.SetStateAction<QueueItem[]>>;
  setServed: React.Dispatch<React.SetStateAction<QueueItem[]>>;
  refetch: () => Promise<void>;
}

interface PickupRequestPayload {
  id: string;
  created_at: string;
  pickup_date: string;
  employee_identifier: string;
  profile_id: string | null;
  meal_name_snapshot: string | null;
  status: string;
  served_at: string | null;
}

const FALLBACK_POLLING_INTERVAL = 45000; // 45 seconds
const VISIBILITY_THRESHOLD = 5000; // 5 seconds

// Short notification sound (base64 encoded beep)
const NOTIFICATION_SOUND_URL = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1sbW1tcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcA==";

// Play notification sound
const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.volume = 0.5;
    audio.play().catch((err) => {
      if (import.meta.env.DEV) {
        console.log('[Kiosk] Audio play failed (user interaction required):', err);
      }
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[Kiosk] Audio error:', err);
    }
  }
};

export function useKioskRealtime({ token, onAuthError }: UseKioskRealtimeOptions): UseKioskRealtimeReturn {
  const [pending, setPending] = useState<QueueItem[]>([]);
  const [served, setServed] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get today's date in Belgrade timezone
  const getToday = useCallback(() => {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Belgrade" });
  }, []);

  // Fetch queue from API
  const fetchQueue = useCallback(async () => {
    if (!token) {
      onAuthError?.();
      setLoading(false);
      return;
    }

    try {
      const data = await kioskApi.getQueue(token);
      setPending(data.pending || []);
      setServed(data.served || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Queue fetch error:", error);
      if (error instanceof Error && error.message.includes("Nedozvoljen")) {
        onAuthError?.();
      }
    } finally {
      setLoading(false);
    }
  }, [token, onAuthError]);

  // Handle realtime event
  const handleRealtimeEvent = useCallback((
    payload: RealtimePostgresChangesPayload<PickupRequestPayload>
  ) => {
    const today = getToday();
    
    if (payload.eventType === 'INSERT') {
      const newRecord = payload.new as PickupRequestPayload;
      
      // Only process if it's for today
      if (newRecord.pickup_date !== today) return;
      
      const newItem: QueueItem = {
        id: newRecord.id,
        created_at: newRecord.created_at,
        employee_identifier: newRecord.employee_identifier,
        fullName: null, // Will be filled on next fetch
        meal_name_snapshot: newRecord.meal_name_snapshot,
        status: newRecord.status as 'pending' | 'served',
        served_at: newRecord.served_at
      };
      
      if (newRecord.status === 'pending') {
        setPending(prev => {
          // Avoid duplicates
          if (prev.some(p => p.id === newItem.id)) return prev;
          // Play notification sound for new pending item
          playNotificationSound();
          return [...prev, newItem];
        });
      } else if (newRecord.status === 'served') {
        setServed(prev => {
          if (prev.some(s => s.id === newItem.id)) return prev;
          return [newItem, ...prev];
        });
      }
      
      setLastUpdate(new Date());
    }
    
    if (payload.eventType === 'UPDATE') {
      const updatedRecord = payload.new as PickupRequestPayload;
      
      if (updatedRecord.pickup_date !== today) return;
      
      // Remove from both lists first
      setPending(prev => prev.filter(p => p.id !== updatedRecord.id));
      setServed(prev => prev.filter(s => s.id !== updatedRecord.id));
      
      const updatedItem: QueueItem = {
        id: updatedRecord.id,
        created_at: updatedRecord.created_at,
        employee_identifier: updatedRecord.employee_identifier,
        fullName: null, // Preserve from existing or fetch later
        meal_name_snapshot: updatedRecord.meal_name_snapshot,
        status: updatedRecord.status as 'pending' | 'served',
        served_at: updatedRecord.served_at
      };
      
      if (updatedRecord.status === 'pending') {
        setPending(prev => [...prev, updatedItem].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ));
      } else if (updatedRecord.status === 'served') {
        setServed(prev => [updatedItem, ...prev]);
      }
      
      setLastUpdate(new Date());
    }
    
    if (payload.eventType === 'DELETE') {
      const deletedRecord = payload.old as PickupRequestPayload;
      
      setPending(prev => prev.filter(p => p.id !== deletedRecord.id));
      setServed(prev => prev.filter(s => s.id !== deletedRecord.id));
      
      setLastUpdate(new Date());
    }
  }, [getToday]);

  // Setup realtime subscription
  useEffect(() => {
    if (!token) return;

    const today = getToday();
    
    const channel = supabase
      .channel('kiosk-kitchen-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pickup_requests',
          filter: `pickup_date=eq.${today}`
        },
        handleRealtimeEvent
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          if (import.meta.env.DEV) {
            console.log('[Realtime] Connected to pickup_requests channel');
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('disconnected');
          if (import.meta.env.DEV) {
            console.error('[Realtime] Channel error:', err);
          }
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [token, getToday, handleRealtimeEvent]);

  // Initial fetch
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Fallback polling (45s safety net)
  useEffect(() => {
    if (!token) return;

    pollingIntervalRef.current = setInterval(() => {
      if (!isProcessing) {
        fetchQueue();
      }
    }, FALLBACK_POLLING_INTERVAL);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [token, fetchQueue, isProcessing]);

  // Visibility API - force refresh when tab becomes visible after being hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else {
        // Tab is visible again
        const wasHiddenFor = hiddenAtRef.current 
          ? Date.now() - hiddenAtRef.current 
          : 0;
        
        if (wasHiddenFor > VISIBILITY_THRESHOLD) {
          if (import.meta.env.DEV) {
            console.log(`[Realtime] Tab was hidden for ${wasHiddenFor}ms, refreshing...`);
          }
          fetchQueue();
        }
        
        hiddenAtRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchQueue]);

  return {
    pending,
    served,
    loading,
    connectionStatus,
    lastUpdate,
    isProcessing,
    setIsProcessing,
    setPending,
    setServed,
    refetch: fetchQueue
  };
}

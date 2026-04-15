import { useState, useEffect } from "react";
import { onQueueChange, startAutoSync, stopAutoSync } from "@/services/offlineQueue";

/**
 * Hook that tracks offline queue count and manages auto-sync lifecycle.
 */
export function useOfflineQueue() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    startAutoSync();
    const unsubscribe = onQueueChange(setPendingCount);

    return () => {
      unsubscribe();
      stopAutoSync();
    };
  }, []);

  return { pendingCount };
}

/**
 * Offline Queue Service
 * Stores failed kiosk operations (serve, confirm-pickup) in IndexedDB
 * and automatically syncs them when connectivity is restored.
 */

import { kioskApi } from "./kioskApi";

const DB_NAME = "kiosk-offline-queue";
const DB_VERSION = 1;
const STORE_NAME = "operations";
const RETRY_INTERVAL_MS = 10_000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface OfflineOperation {
  id: string;
  type: "serve" | "confirm-pickup";
  token: string;
  pickupRequestId: string;
  kioskType?: "employee" | "kitchen";
  timestamp: number;
  retries: number;
}

type QueueChangeCallback = (count: number) => void;

let db: IDBDatabase | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
let processing = false;
const listeners: Set<QueueChangeCallback> = new Set();

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      store.createIndex("pickupRequestId", "pickupRequestId", { unique: false });
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

async function notifyListeners() {
  const count = await getQueueCount();
  listeners.forEach((cb) => cb(count));
}

export async function enqueue(op: Omit<OfflineOperation, "retries">): Promise<void> {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // Dedup: check if same pickupRequestId+type already queued
    const index = store.index("pickupRequestId");
    const getReq = index.getAll(op.pickupRequestId);

    getReq.onsuccess = () => {
      const existing = getReq.result as OfflineOperation[];
      if (existing.some((e) => e.type === op.type)) {
        resolve(); // Already queued
        return;
      }

      const putReq = store.put({ ...op, retries: 0 });
      putReq.onsuccess = () => {
        notifyListeners();
        resolve();
      };
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

async function removeOp(id: string): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => {
      notifyListeners();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

async function getAllOps(): Promise<OfflineOperation[]> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getQueueCount(): Promise<number> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function processQueue(): Promise<void> {
  if (processing || !navigator.onLine) return;
  processing = true;

  try {
    const ops = await getAllOps();
    const now = Date.now();

    for (const op of ops) {
      // Remove stale operations (older than 24h)
      if (now - op.timestamp > MAX_AGE_MS) {
        await removeOp(op.id);
        continue;
      }

      try {
        if (op.type === "serve") {
          await kioskApi.serve(op.token, op.pickupRequestId);
        } else if (op.type === "confirm-pickup") {
          await kioskApi.confirmPickup(op.token, op.pickupRequestId, op.kioskType || "employee");
        }
        // Success - remove from queue
        await removeOp(op.id);
        console.log(`[OfflineQueue] Synced ${op.type} for ${op.pickupRequestId}`);
      } catch (err) {
        // If it's a network error, stop processing (still offline)
        if (isNetworkError(err)) {
          console.log("[OfflineQueue] Still offline, stopping sync");
          break;
        }
        // Server error (e.g. already served) - remove from queue, it's handled
        console.warn(`[OfflineQueue] Server rejected ${op.type} for ${op.pickupRequestId}:`, err);
        await removeOp(op.id);
      }
    }
  } finally {
    processing = false;
  }
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) return true;
  if (error instanceof TypeError && error.message.toLowerCase().includes("network")) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (!navigator.onLine) return true;
  return false;
}

export function startAutoSync(): void {
  if (retryTimer) return;

  // Process on online event
  window.addEventListener("online", processQueue);

  // Periodic retry
  retryTimer = setInterval(() => {
    if (navigator.onLine) {
      processQueue();
    }
  }, RETRY_INTERVAL_MS);

  // Try immediately
  processQueue();
}

export function stopAutoSync(): void {
  window.removeEventListener("online", processQueue);
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

export function onQueueChange(cb: QueueChangeCallback): () => void {
  listeners.add(cb);
  // Immediately notify with current count
  getQueueCount().then((count) => cb(count));
  return () => listeners.delete(cb);
}

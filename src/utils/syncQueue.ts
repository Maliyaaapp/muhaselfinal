/**
 * Sync Queue System - Local-First Architecture
 * 
 * All operations are saved locally first, then queued for background sync to Supabase.
 * User never waits for server responses - everything feels instant.
 */

// Operation types
export type SyncOperationType = 'create' | 'update' | 'delete';
export type SyncEntityType = 'students' | 'fees' | 'installments' | 'settings' | 'templates' | 'messages';

// Priority levels (lower = higher priority)
export const SYNC_PRIORITY = {
  CRITICAL: 1,    // Payments, receipts
  HIGH: 2,        // Student data, fees
  NORMAL: 3,      // Settings, templates
  LOW: 4,         // Analytics, logs
} as const;

export interface SyncOperation {
  id: string;
  entityType: SyncEntityType;
  operationType: SyncOperationType;
  entityId: string;
  data: any;
  timestamp: number;
  priority: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
  schoolId?: string;
}

export interface SyncQueueState {
  pending: number;
  processing: number;
  failed: number;
  lastSyncTime: number | null;
  isOnline: boolean;
  isSyncing: boolean;
}

// Storage keys
const SYNC_QUEUE_KEY = 'sync_queue';
const SYNC_STATE_KEY = 'sync_state';

// Event emitter for sync status updates
type SyncEventCallback = (state: SyncQueueState) => void;
const listeners: Set<SyncEventCallback> = new Set();

/**
 * Generate unique ID for sync operation
 */
const generateSyncId = (): string => {
  return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get current sync queue from localStorage
 */
export const getSyncQueue = (): SyncOperation[] => {
  try {
    const stored = localStorage.getItem(SYNC_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * Save sync queue to localStorage
 */
const saveSyncQueue = (queue: SyncOperation[]): void => {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[SyncQueue] Failed to save queue:', error);
  }
};

/**
 * Get current sync state
 */
export const getSyncState = (): SyncQueueState => {
  try {
    const stored = localStorage.getItem(SYNC_STATE_KEY);
    const state = stored ? JSON.parse(stored) : null;
    
    if (state) {
      return {
        ...state,
        isOnline: navigator.onLine,
      };
    }
  } catch {
    // Ignore
  }
  
  return {
    pending: 0,
    processing: 0,
    failed: 0,
    lastSyncTime: null,
    isOnline: navigator.onLine,
    isSyncing: false,
  };
};

/**
 * Update and broadcast sync state
 */
const updateSyncState = (updates: Partial<SyncQueueState>): void => {
  const queue = getSyncQueue();
  const currentState = getSyncState();
  
  const newState: SyncQueueState = {
    ...currentState,
    ...updates,
    pending: queue.filter(op => op.status === 'pending').length,
    processing: queue.filter(op => op.status === 'processing').length,
    failed: queue.filter(op => op.status === 'failed').length,
    isOnline: navigator.onLine,
  };
  
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(newState));
  } catch {
    // Ignore
  }
  
  // Notify listeners
  listeners.forEach(callback => {
    try {
      callback(newState);
    } catch (error) {
      console.error('[SyncQueue] Listener error:', error);
    }
  });
};

/**
 * Subscribe to sync state changes
 */
export const subscribeSyncState = (callback: SyncEventCallback): (() => void) => {
  listeners.add(callback);
  // Immediately call with current state
  callback(getSyncState());
  
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Add operation to sync queue
 * Returns immediately - sync happens in background
 */
export const queueSyncOperation = (
  entityType: SyncEntityType,
  operationType: SyncOperationType,
  entityId: string,
  data: any,
  priority: number = SYNC_PRIORITY.NORMAL,
  schoolId?: string
): string => {
  const operation: SyncOperation = {
    id: generateSyncId(),
    entityType,
    operationType,
    entityId,
    data,
    timestamp: Date.now(),
    priority,
    retryCount: 0,
    maxRetries: 3,
    status: 'pending',
    schoolId,
  };
  
  const queue = getSyncQueue();
  
  // Check for duplicate/superseding operations
  // If we're updating the same entity, remove older pending updates
  const filteredQueue = queue.filter(op => {
    if (op.entityType === entityType && op.entityId === entityId && op.status === 'pending') {
      // Keep delete operations, they supersede everything
      if (operationType === 'delete') {
        return false; // Remove old operation, new delete takes precedence
      }
      // For updates, keep only the latest
      if (op.operationType === 'update' && operationType === 'update') {
        return false; // Remove old update
      }
    }
    return true;
  });
  
  filteredQueue.push(operation);
  
  // Sort by priority and timestamp
  filteredQueue.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.timestamp - b.timestamp;
  });
  
  saveSyncQueue(filteredQueue);
  updateSyncState({});
  
  console.log(`[SyncQueue] Queued ${operationType} for ${entityType}:${entityId}`);
  
  // Trigger background sync
  triggerBackgroundSync();
  
  return operation.id;
};

/**
 * Remove completed operations from queue
 */
export const cleanupCompletedOperations = (): void => {
  const queue = getSyncQueue();
  const cleaned = queue.filter(op => op.status !== 'completed');
  saveSyncQueue(cleaned);
  updateSyncState({});
};

/**
 * Retry failed operations
 */
export const retryFailedOperations = (): void => {
  const queue = getSyncQueue();
  let updated = false;
  
  queue.forEach(op => {
    if (op.status === 'failed' && op.retryCount < op.maxRetries) {
      op.status = 'pending';
      updated = true;
    }
  });
  
  if (updated) {
    saveSyncQueue(queue);
    updateSyncState({});
    triggerBackgroundSync();
  }
};

/**
 * Clear all failed operations
 */
export const clearFailedOperations = (): void => {
  const queue = getSyncQueue();
  const cleaned = queue.filter(op => op.status !== 'failed');
  saveSyncQueue(cleaned);
  updateSyncState({});
};

// Background sync processing
let syncInProgress = false;
let syncTimeout: NodeJS.Timeout | null = null;

/**
 * Trigger background sync (debounced)
 */
export const triggerBackgroundSync = (): void => {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  
  // Debounce sync to batch operations
  syncTimeout = setTimeout(() => {
    processBackgroundSync();
  }, 100);
};

/**
 * Process sync queue in background
 */
const processBackgroundSync = async (): Promise<void> => {
  if (syncInProgress) {
    console.log('[SyncQueue] Sync already in progress, skipping');
    return;
  }
  
  if (!navigator.onLine) {
    console.log('[SyncQueue] Offline, skipping sync');
    updateSyncState({ isOnline: false });
    return;
  }
  
  const queue = getSyncQueue();
  const pendingOps = queue.filter(op => op.status === 'pending');
  
  if (pendingOps.length === 0) {
    console.log('[SyncQueue] No pending operations');
    return;
  }
  
  syncInProgress = true;
  updateSyncState({ isSyncing: true });
  
  console.log(`[SyncQueue] Processing ${pendingOps.length} pending operations`);
  
  // Process operations in batches of 5
  const batchSize = 5;
  for (let i = 0; i < pendingOps.length; i += batchSize) {
    const batch = pendingOps.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (op) => {
      try {
        // Mark as processing
        op.status = 'processing';
        saveSyncQueue(queue);
        
        // Execute the sync operation
        await executeSyncOperation(op);
        
        // Mark as completed
        op.status = 'completed';
        console.log(`[SyncQueue] ✅ Synced ${op.operationType} ${op.entityType}:${op.entityId}`);
      } catch (error: any) {
        op.retryCount++;
        op.error = error.message || 'Unknown error';
        
        if (op.retryCount >= op.maxRetries) {
          op.status = 'failed';
          console.error(`[SyncQueue] ❌ Failed after ${op.maxRetries} retries:`, op.entityType, op.entityId, error);
        } else {
          op.status = 'pending';
          console.warn(`[SyncQueue] ⚠️ Retry ${op.retryCount}/${op.maxRetries}:`, op.entityType, op.entityId);
        }
      }
    }));
    
    saveSyncQueue(queue);
    updateSyncState({});
  }
  
  // Cleanup completed operations
  cleanupCompletedOperations();
  
  syncInProgress = false;
  updateSyncState({ 
    isSyncing: false, 
    lastSyncTime: Date.now() 
  });
  
  console.log('[SyncQueue] Sync cycle complete');
};

/**
 * Execute a single sync operation against Supabase
 */
const executeSyncOperation = async (op: SyncOperation): Promise<void> => {
  // Dynamic import to avoid circular dependencies
  const { supabase, shouldUseSupabase } = await import('../services/supabase');
  
  if (!shouldUseSupabase()) {
    throw new Error('Supabase not available');
  }
  
  const tableMap: Record<SyncEntityType, string> = {
    students: 'students',
    fees: 'fees',
    installments: 'installments',
    settings: 'settings',
    templates: 'templates',
    messages: 'messages',
  };
  
  const table = tableMap[op.entityType];
  
  switch (op.operationType) {
    case 'create':
    case 'update': {
      const { error } = await supabase
        .from(table)
        .upsert(op.data, { onConflict: 'id' });
      
      if (error) throw error;
      break;
    }
    
    case 'delete': {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', op.entityId);
      
      if (error) throw error;
      break;
    }
  }
};

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncQueue] 🌐 Back online - triggering sync');
    updateSyncState({ isOnline: true });
    triggerBackgroundSync();
  });
  
  window.addEventListener('offline', () => {
    console.log('[SyncQueue] 📵 Gone offline');
    updateSyncState({ isOnline: false });
  });
}

// Export for manual sync trigger
export const forceSync = (): void => {
  syncInProgress = false; // Reset flag
  triggerBackgroundSync();
};

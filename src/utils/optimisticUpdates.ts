/**
 * Optimistic Updates Helper
 * 
 * Provides utilities for instant UI updates with background sync.
 * All operations update local state immediately, then queue for sync.
 */

import { queueSyncOperation, SYNC_PRIORITY, SyncEntityType } from './syncQueue';

/**
 * Perform an optimistic create operation
 * Returns immediately after local save, syncs in background
 */
export const optimisticCreate = <T extends { id: string }>(
  entityType: SyncEntityType,
  data: T,
  localSaveFn: (data: T) => void,
  priority: number = SYNC_PRIORITY.NORMAL,
  schoolId?: string
): T => {
  // Save locally first (instant)
  localSaveFn(data);
  
  // Queue for background sync
  queueSyncOperation(entityType, 'create', data.id, data, priority, schoolId);
  
  return data;
};

/**
 * Perform an optimistic update operation
 * Returns immediately after local save, syncs in background
 */
export const optimisticUpdate = <T extends { id: string }>(
  entityType: SyncEntityType,
  data: T,
  localUpdateFn: (data: T) => void,
  priority: number = SYNC_PRIORITY.NORMAL,
  schoolId?: string
): T => {
  // Update locally first (instant)
  localUpdateFn(data);
  
  // Queue for background sync
  queueSyncOperation(entityType, 'update', data.id, data, priority, schoolId);
  
  return data;
};

/**
 * Perform an optimistic delete operation
 * Returns immediately after local delete, syncs in background
 */
export const optimisticDelete = (
  entityType: SyncEntityType,
  entityId: string,
  localDeleteFn: (id: string) => void,
  priority: number = SYNC_PRIORITY.NORMAL,
  schoolId?: string
): void => {
  // Delete locally first (instant)
  localDeleteFn(entityId);
  
  // Queue for background sync
  queueSyncOperation(entityType, 'delete', entityId, { id: entityId }, priority, schoolId);
};

/**
 * Perform optimistic bulk delete
 * Deletes all items locally first, then queues for background sync
 */
export const optimisticBulkDelete = (
  entityType: SyncEntityType,
  entityIds: string[],
  localDeleteFn: (ids: string[]) => void,
  priority: number = SYNC_PRIORITY.NORMAL,
  schoolId?: string
): void => {
  // Delete all locally first (instant)
  localDeleteFn(entityIds);
  
  // Queue each delete for background sync
  entityIds.forEach(id => {
    queueSyncOperation(entityType, 'delete', id, { id }, priority, schoolId);
  });
};

/**
 * Perform optimistic bulk update
 * Updates all items locally first, then queues for background sync
 */
export const optimisticBulkUpdate = <T extends { id: string }>(
  entityType: SyncEntityType,
  items: T[],
  localUpdateFn: (items: T[]) => void,
  priority: number = SYNC_PRIORITY.NORMAL,
  schoolId?: string
): void => {
  // Update all locally first (instant)
  localUpdateFn(items);
  
  // Queue each update for background sync
  items.forEach(item => {
    queueSyncOperation(entityType, 'update', item.id, item, priority, schoolId);
  });
};

/**
 * Helper to generate a temporary ID for new records
 */
export const generateTempId = (): string => {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if an ID is a temporary ID (not yet synced)
 */
export const isTempId = (id: string): boolean => {
  return id.startsWith('temp_');
};

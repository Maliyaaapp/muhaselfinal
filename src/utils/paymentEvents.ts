/**
 * Payment Events System
 * Handles real-time communication between Fees and Installments pages
 * 
 * USES localStorage events for cross-component communication
 * This works even when target component is NOT mounted
 */

// Event type constants
export const PAYMENT_EVENTS = {
  FULL_PAYMENT_COMPLETED: 'payment:full_completed',
  PARTIAL_PAYMENT_COMPLETED: 'payment:partial_completed',
  INSTALLMENT_PAYMENT_COMPLETED: 'payment:installment_completed',
  BATCH_PAYMENT_COMPLETED: 'payment:batch_completed',
  PAYMENT_FAILED: 'payment:failed',
  PAYMENT_SYNC_COMPLETED: 'payment:sync_completed',
} as const;

export type PaymentEventType = (typeof PAYMENT_EVENTS)[keyof typeof PAYMENT_EVENTS];

// Storage key for tracking when data needs refresh
const PAYMENT_REFRESH_KEY = 'payment_refresh_needed';
const PAYMENT_LAST_EVENT_KEY = 'payment_last_event';

// Event payload interfaces
export interface BasePaymentEvent {
  timestamp: number;
  schoolId?: string;
}

export interface FullPaymentEvent extends BasePaymentEvent {
  type: typeof PAYMENT_EVENTS.FULL_PAYMENT_COMPLETED;
  feeId: string;
  studentId: string;
  amountPaid: number;
  remainingBalance: number;
}

export interface PartialPaymentEvent extends BasePaymentEvent {
  type: typeof PAYMENT_EVENTS.PARTIAL_PAYMENT_COMPLETED;
  feeId: string;
  studentId: string;
  amountPaid: number;
  remainingBalance: number;
  installmentsPaid?: string[];
}

export interface InstallmentPaymentEvent extends BasePaymentEvent {
  type: typeof PAYMENT_EVENTS.INSTALLMENT_PAYMENT_COMPLETED;
  installmentId: string;
  feeId: string;
  studentId: string;
  amountPaid: number;
}

export interface BatchPaymentEvent extends BasePaymentEvent {
  type: typeof PAYMENT_EVENTS.BATCH_PAYMENT_COMPLETED;
  feeIds: string[];
  totalAmountPaid: number;
  affectedInstallmentIds?: string[];
}

export interface PaymentFailedEvent extends BasePaymentEvent {
  type: typeof PAYMENT_EVENTS.PAYMENT_FAILED;
  feeId?: string;
  error: string;
}

export interface PaymentSyncEvent extends BasePaymentEvent {
  type: typeof PAYMENT_EVENTS.PAYMENT_SYNC_COMPLETED;
  syncedCount: number;
}

export type PaymentEvent =
  | FullPaymentEvent
  | PartialPaymentEvent
  | InstallmentPaymentEvent
  | BatchPaymentEvent
  | PaymentFailedEvent
  | PaymentSyncEvent;

/**
 * Mark that a refresh is needed for specific data types
 * This persists in localStorage so unmounted components can check on mount
 */
export function markRefreshNeeded(dataTypes: ('fees' | 'installments')[]): void {
  const current = getRefreshNeeded();
  const updated = {
    ...current,
    timestamp: Date.now(),
  };
  
  dataTypes.forEach(type => {
    updated[type] = Date.now();
  });
  
  localStorage.setItem(PAYMENT_REFRESH_KEY, JSON.stringify(updated));
  console.log('[PaymentEvents] 📌 Marked refresh needed:', dataTypes);
}

/**
 * Get which data types need refresh
 */
export function getRefreshNeeded(): { fees?: number; installments?: number; timestamp?: number } {
  try {
    const stored = localStorage.getItem(PAYMENT_REFRESH_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Clear refresh flag for a specific data type
 * Call this AFTER successfully refreshing data
 */
export function clearRefreshNeeded(dataType: 'fees' | 'installments'): void {
  const current = getRefreshNeeded();
  delete current[dataType];
  localStorage.setItem(PAYMENT_REFRESH_KEY, JSON.stringify(current));
  console.log('[PaymentEvents] ✅ Cleared refresh flag for:', dataType);
}

/**
 * Check if refresh is needed for a data type
 * Returns the timestamp when refresh was requested, or null if not needed
 */
export function isRefreshNeeded(dataType: 'fees' | 'installments'): number | null {
  const needed = getRefreshNeeded();
  return needed[dataType] || null;
}

// Event emitter class for in-memory events (when component IS mounted)
class PaymentEventEmitter {
  private listeners: Map<string, Set<(event: PaymentEvent) => void>> = new Map();

  /**
   * Subscribe to payment events
   */
  on(eventType: PaymentEventType | 'all', callback: (event: PaymentEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
    console.log(`[PaymentEvents] 🔔 Subscribed to ${eventType}, total listeners: ${this.listeners.get(eventType)!.size}`);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
      console.log(`[PaymentEvents] 🔕 Unsubscribed from ${eventType}`);
    };
  }

  /**
   * Emit a payment event
   * Also marks refresh needed in localStorage for unmounted components
   */
  emit(event: PaymentEvent): void {
    console.log(`[PaymentEvents] 📤 Emitting ${event.type}`, event);

    // Store last event in localStorage for debugging
    try {
      localStorage.setItem(PAYMENT_LAST_EVENT_KEY, JSON.stringify(event));
    } catch (e) {
      // Ignore storage errors
    }

    // Mark refresh needed based on event type
    if (
      event.type === PAYMENT_EVENTS.FULL_PAYMENT_COMPLETED ||
      event.type === PAYMENT_EVENTS.PARTIAL_PAYMENT_COMPLETED ||
      event.type === PAYMENT_EVENTS.BATCH_PAYMENT_COMPLETED
    ) {
      // Payment from Fees page - Installments needs refresh
      markRefreshNeeded(['installments']);
    } else if (event.type === PAYMENT_EVENTS.INSTALLMENT_PAYMENT_COMPLETED) {
      // Payment from Installments page - Fees needs refresh
      markRefreshNeeded(['fees']);
    }

    // Emit to in-memory listeners (for mounted components)
    const specificListeners = this.listeners.get(event.type);
    if (specificListeners && specificListeners.size > 0) {
      console.log(`[PaymentEvents] 📬 Notifying ${specificListeners.size} specific listeners`);
      specificListeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error('[PaymentEvents] Error in listener:', error);
        }
      });
    }

    // Also emit to 'all' listeners
    const allListeners = this.listeners.get('all');
    if (allListeners && allListeners.size > 0) {
      console.log(`[PaymentEvents] 📬 Notifying ${allListeners.size} 'all' listeners`);
      allListeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error('[PaymentEvents] Error in all listener:', error);
        }
      });
    }

    if ((!specificListeners || specificListeners.size === 0) && (!allListeners || allListeners.size === 0)) {
      console.log('[PaymentEvents] ⚠️ No listeners registered - refresh flag set in localStorage');
    }
  }
}

// Singleton instance
export const paymentEvents = new PaymentEventEmitter();

/**
 * Helper function to emit payment events with proper typing
 */
export function emitPaymentEvent(event: PaymentEvent): void {
  paymentEvents.emit(event);
}

/**
 * Helper to create a full payment event
 */
export function emitFullPayment(data: Omit<FullPaymentEvent, 'type' | 'timestamp'>): void {
  emitPaymentEvent({
    ...data,
    type: PAYMENT_EVENTS.FULL_PAYMENT_COMPLETED,
    timestamp: Date.now(),
  });
}

/**
 * Helper to create a partial payment event
 */
export function emitPartialPayment(data: Omit<PartialPaymentEvent, 'type' | 'timestamp'>): void {
  emitPaymentEvent({
    ...data,
    type: PAYMENT_EVENTS.PARTIAL_PAYMENT_COMPLETED,
    timestamp: Date.now(),
  });
}

/**
 * Helper to create an installment payment event
 */
export function emitInstallmentPayment(
  data: Omit<InstallmentPaymentEvent, 'type' | 'timestamp'>
): void {
  emitPaymentEvent({
    ...data,
    type: PAYMENT_EVENTS.INSTALLMENT_PAYMENT_COMPLETED,
    timestamp: Date.now(),
  });
}

/**
 * Helper to create a batch payment event
 */
export function emitBatchPayment(data: Omit<BatchPaymentEvent, 'type' | 'timestamp'>): void {
  emitPaymentEvent({
    ...data,
    type: PAYMENT_EVENTS.BATCH_PAYMENT_COMPLETED,
    timestamp: Date.now(),
  });
}

/**
 * Helper to emit payment failure
 */
export function emitPaymentFailed(data: Omit<PaymentFailedEvent, 'type' | 'timestamp'>): void {
  emitPaymentEvent({
    ...data,
    type: PAYMENT_EVENTS.PAYMENT_FAILED,
    timestamp: Date.now(),
  });
}

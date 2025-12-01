/**
 * React hook for listening to payment events
 * Used by Installments page to auto-refresh after payments
 * 
 * FIXED: Stable subscription lifecycle - subscribes ONCE on mount, unsubscribes ONCE on unmount
 */

import { useEffect, useRef } from 'react';
import {
  paymentEvents,
  PaymentEvent,
  PaymentEventType,
  PAYMENT_EVENTS,
} from '../utils/paymentEvents';

interface UsePaymentListenerOptions {
  /** Debounce time in ms to prevent rapid refreshes */
  debounceMs?: number;
  /** Only listen to events for this school */
  schoolId?: string;
  /** Callback when any payment event is received */
  onPaymentEvent?: (event: PaymentEvent) => void;
  /** Callback to refresh data */
  onRefresh?: () => void | Promise<void>;
  /** Whether the listener is enabled */
  enabled?: boolean;
}

/**
 * Hook to listen for payment events and trigger refreshes
 * Uses refs to maintain stable subscription throughout component lifecycle
 */
export function usePaymentListener(options: UsePaymentListenerOptions = {}) {
  const {
    debounceMs = 150,
    schoolId,
    onPaymentEvent,
    onRefresh,
    enabled = true,
  } = options;

  // Use refs to store callbacks - this prevents re-subscription on every render
  const onPaymentEventRef = useRef(onPaymentEvent);
  const onRefreshRef = useRef(onRefresh);
  const schoolIdRef = useRef(schoolId);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimestampRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);
  const isSubscribedRef = useRef<boolean>(false);

  // Update refs when callbacks change (without triggering re-subscription)
  useEffect(() => {
    onPaymentEventRef.current = onPaymentEvent;
  }, [onPaymentEvent]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    schoolIdRef.current = schoolId;
  }, [schoolId]);

  // Subscribe ONCE on mount, unsubscribe ONCE on unmount
  useEffect(() => {
    if (!enabled) {
      console.log('[usePaymentListener] Disabled, not subscribing');
      return;
    }

    // Prevent duplicate subscriptions
    if (isSubscribedRef.current) {
      console.log('[usePaymentListener] Already subscribed, skipping');
      return;
    }

    console.log('[usePaymentListener] 🔔 Subscribing to payment events (ONCE)');
    isSubscribedRef.current = true;

    // Event handler that uses refs for latest values
    const handlePaymentEvent = (event: PaymentEvent) => {
      console.log('[usePaymentListener] 📬 Event received:', event.type);

      // Skip if event is older than last processed
      if (event.timestamp <= lastEventTimestampRef.current) {
        console.log('[usePaymentListener] Skipping old event', event.timestamp);
        return;
      }

      // Filter by school if specified (use ref for latest value)
      const currentSchoolId = schoolIdRef.current;
      if (currentSchoolId && event.schoolId && event.schoolId !== currentSchoolId) {
        console.log('[usePaymentListener] Skipping event for different school');
        return;
      }

      lastEventTimestampRef.current = event.timestamp;

      // Call custom handler if provided (use ref for latest callback)
      if (onPaymentEventRef.current) {
        try {
          onPaymentEventRef.current(event);
        } catch (err) {
          console.error('[usePaymentListener] Error in onPaymentEvent callback:', err);
        }
      }

      // Trigger debounced refresh for payment completion events
      if (
        event.type === PAYMENT_EVENTS.FULL_PAYMENT_COMPLETED ||
        event.type === PAYMENT_EVENTS.PARTIAL_PAYMENT_COMPLETED ||
        event.type === PAYMENT_EVENTS.INSTALLMENT_PAYMENT_COMPLETED ||
        event.type === PAYMENT_EVENTS.BATCH_PAYMENT_COMPLETED ||
        event.type === PAYMENT_EVENTS.PAYMENT_SYNC_COMPLETED
      ) {
        // Clear existing debounce timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Set new debounce timer
        debounceTimerRef.current = setTimeout(async () => {
          if (isRefreshingRef.current) {
            console.log('[usePaymentListener] Refresh already in progress, skipping');
            return;
          }

          isRefreshingRef.current = true;
          console.log('[usePaymentListener] 🔄 Triggering refresh callback...');

          try {
            // Use ref for latest callback
            if (onRefreshRef.current) {
              await onRefreshRef.current();
              console.log('[usePaymentListener] ✅ Refresh completed');
            } else {
              console.log('[usePaymentListener] ⚠️ No onRefresh callback provided');
            }
          } catch (error) {
            console.error('[usePaymentListener] ❌ Refresh error:', error);
          } finally {
            isRefreshingRef.current = false;
          }
        }, debounceMs);
      }
    };

    // Subscribe to all payment events
    const unsubscribe = paymentEvents.on('all', handlePaymentEvent);

    // Cleanup on unmount ONLY
    return () => {
      console.log('[usePaymentListener] 🔕 Unsubscribing from payment events (unmount)');
      isSubscribedRef.current = false;
      unsubscribe();

      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [enabled, debounceMs]); // Only re-subscribe if enabled or debounceMs changes

  // Manual refresh trigger
  const triggerRefresh = async () => {
    if (isRefreshingRef.current) {
      console.log('[usePaymentListener] Refresh already in progress');
      return;
    }

    isRefreshingRef.current = true;
    try {
      if (onRefreshRef.current) {
        await onRefreshRef.current();
      }
    } finally {
      isRefreshingRef.current = false;
    }
  };

  return {
    /** Manually trigger a refresh */
    triggerRefresh,
    /** Whether a refresh is currently in progress */
    isRefreshing: isRefreshingRef.current,
  };
}

/**
 * Hook to listen for specific payment event types
 */
export function usePaymentEventType(
  eventType: PaymentEventType,
  callback: (event: PaymentEvent) => void,
  enabled: boolean = true
) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: PaymentEvent) => {
      callbackRef.current(event);
    };

    const unsubscribe = paymentEvents.on(eventType, handler);
    return unsubscribe;
  }, [eventType, enabled]);
}

export default usePaymentListener;

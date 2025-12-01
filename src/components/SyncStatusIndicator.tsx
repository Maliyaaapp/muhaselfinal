/**
 * Sync Status Indicator Component
 * Shows sync status in a small, unobtrusive way
 */

import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { 
  getSyncState, 
  subscribeSyncState, 
  retryFailedOperations,
  forceSync,
  SyncQueueState 
} from '../utils/syncQueue';

const SyncStatusIndicator = () => {
  const [state, setState] = useState<SyncQueueState>(getSyncState());
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeSyncState(setState);
    return unsubscribe;
  }, []);

  const getStatusIcon = () => {
    if (!state.isOnline) {
      return <CloudOff size={16} className="text-gray-400" />;
    }
    if (state.isSyncing) {
      return <RefreshCw size={16} className="text-blue-500 animate-spin" />;
    }
    if (state.failed > 0) {
      return <AlertTriangle size={16} className="text-amber-500" />;
    }
    if (state.pending > 0) {
      return <Cloud size={16} className="text-blue-400" />;
    }
    return <Check size={16} className="text-green-500" />;
  };

  const getStatusText = () => {
    if (!state.isOnline) return 'غير متصل';
    if (state.isSyncing) return 'جاري المزامنة...';
    if (state.failed > 0) return `${state.failed} فشل`;
    if (state.pending > 0) return `${state.pending} قيد الانتظار`;
    return 'متزامن';
  };

  const handleRetry = () => {
    retryFailedOperations();
  };

  const handleForceSync = () => {
    forceSync();
  };

  // Don't show if everything is synced and online
  const shouldShow = !state.isOnline || state.isSyncing || state.pending > 0 || state.failed > 0;

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title={getStatusText()}
      >
        {getStatusIcon()}
        {(state.pending > 0 || state.failed > 0) && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {state.pending + state.failed}
          </span>
        )}
      </button>

      {showDetails && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50">
          <div className="text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">الحالة:</span>
              <span className={`font-medium ${state.isOnline ? 'text-green-600' : 'text-red-500'}`}>
                {state.isOnline ? 'متصل' : 'غير متصل'}
              </span>
            </div>
            
            {state.pending > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-300">قيد الانتظار:</span>
                <span className="text-blue-600">{state.pending}</span>
              </div>
            )}
            
            {state.failed > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-300">فشل:</span>
                <span className="text-red-500">{state.failed}</span>
              </div>
            )}
            
            {state.lastSyncTime && (
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>آخر مزامنة:</span>
                <span>{new Date(state.lastSyncTime).toLocaleTimeString('ar-SA')}</span>
              </div>
            )}
            
            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              {state.failed > 0 && (
                <button
                  onClick={handleRetry}
                  className="flex-1 px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                >
                  إعادة المحاولة
                </button>
              )}
              <button
                onClick={handleForceSync}
                className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                مزامنة الآن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatusIndicator;

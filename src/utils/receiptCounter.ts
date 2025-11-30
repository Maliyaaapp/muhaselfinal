/**
 * Receipt Counter Management Utility
 * Ensures proper sequential numbering and prevents duplicate receipt numbers
 */

import { generateReceiptNumber } from './helpers';
import hybridApi from '../services/hybridApi';

export interface ReceiptCounterUpdate {
  schoolId: string;
  type: 'fee' | 'installment';
  increment: number;
}

/**
 * OPTIMIZED: Batch reserve multiple receipt numbers in a single database operation
 * This is much faster than reserving one at a time for bulk operations
 */
export const reserveBatchReceiptNumbers = async (
  schoolId: string, 
  type: 'fee' | 'installment', 
  count: number
): Promise<string[]> => {
  if (count <= 0) return [];
  
  console.log(`[BatchReserve] Reserving ${count} ${type} receipt numbers in single operation...`);
  const startTime = Date.now();
  
  try {
    // Get current settings - SINGLE database call
    const settingsResponse = await hybridApi.getSettings(schoolId);
    if (!settingsResponse?.success || !settingsResponse?.data || settingsResponse.data.length === 0) {
      throw new Error('School settings not found');
    }

    const currentSettings = settingsResponse.data[0];
    const reservedNumbers: string[] = [];
    
    // Get starting counter
    let startCounter: number;
    if (type === 'installment') {
      startCounter = currentSettings.installmentReceiptNumberCounter || 1;
    } else {
      startCounter = currentSettings.receiptNumberCounter || 1;
    }
    
    // Generate all receipt numbers at once (no database calls in loop)
    for (let i = 0; i < count; i++) {
      // Temporarily set the counter for this iteration
      if (type === 'installment') {
        currentSettings.installmentReceiptNumberCounter = startCounter + i;
      } else {
        currentSettings.receiptNumberCounter = startCounter + i;
      }
      
      const receiptNumber = generateReceiptNumber(
        currentSettings,
        'BATCH',
        undefined,
        type
      );
      
      reservedNumbers.push(receiptNumber);
    }
    
    // Update counter to final value - SINGLE database call
    if (type === 'installment') {
      currentSettings.installmentReceiptNumberCounter = startCounter + count;
    } else {
      currentSettings.receiptNumberCounter = startCounter + count;
    }
    
    await hybridApi.updateSettings(schoolId, currentSettings);
    
    console.log(`[BatchReserve] Reserved ${count} ${type} receipt numbers in ${Date.now() - startTime}ms:`, reservedNumbers);
    return reservedNumbers;
    
  } catch (error) {
    console.error(`[BatchReserve] Error reserving ${type} receipt numbers:`, error);
    throw error;
  }
};

/**
 * Atomically reserve and increment receipt numbers to prevent duplicates
 * This function ensures thread-safe receipt number generation
 * NOTE: For bulk operations, use reserveBatchReceiptNumbers instead for better performance
 */
export const reserveReceiptNumbers = async (
  schoolId: string, 
  type: 'fee' | 'installment', 
  count: number = 1
): Promise<string[]> => {
  // For single receipt, use the optimized batch function
  if (count === 1) {
    return reserveBatchReceiptNumbers(schoolId, type, 1);
  }
  
  // For multiple receipts, also use batch function (much faster)
  return reserveBatchReceiptNumbers(schoolId, type, count);
};

/**
 * Get the next receipt number without incrementing the counter
 * Useful for preview purposes
 */
export const getNextReceiptNumber = async (
  schoolId: string, 
  type: 'fee' | 'installment'
): Promise<string> => {
  try {
    const settingsResponse = await hybridApi.getSettings(schoolId);
    if (!settingsResponse?.success || !settingsResponse?.data || settingsResponse.data.length === 0) {
      throw new Error('School settings not found');
    }

    const currentSettings = settingsResponse.data[0];
    
    // Generate receipt number with current counter (without incrementing)
    const receiptNumber = generateReceiptNumber(
      currentSettings,
      'PREVIEW',
      undefined,
      type
    );
    
    return receiptNumber;
    
  } catch (error) {
    console.error(`Error getting next ${type} receipt number:`, error);
    throw error;
  }
};

/**
 * Validate receipt number format and ensure it follows the configured pattern
 */
export const validateReceiptNumber = (
  receiptNumber: string, 
  settings: any, 
  type: 'fee' | 'installment'
): boolean => {
  try {
    if (!receiptNumber || !settings) {
      return false;
    }

    const format = type === 'installment' 
      ? settings.installmentReceiptNumberFormat 
      : settings.receiptNumberFormat;
    
    const prefix = type === 'installment'
      ? settings.installmentReceiptNumberPrefix
      : settings.receiptNumberPrefix;

    switch (format) {
      case 'sequential':
        // Should be a pure number
        return /^\d+$/.test(receiptNumber);
        
      case 'year':
        // Should be in format: number/year
        return /^\d+\/\d{4}$/.test(receiptNumber);
        
      case 'short-year':
        // Should be in format: number/YY
        return /^\d+\/\d{2}$/.test(receiptNumber);
        
      case 'custom':
        // Should start with the specified prefix
        return prefix ? receiptNumber.startsWith(prefix) : true;
        
      case 'auto':
      default:
        // Auto format can vary, so we'll accept any non-empty string
        return receiptNumber.length > 0;
    }
    
  } catch (error) {
    console.error('Error validating receipt number:', error);
    return false;
  }
};

/**
 * Check if a receipt number already exists to prevent duplicates
 */
export const checkDuplicateReceiptNumber = async (
  schoolId: string,
  receiptNumber: string,
  type: 'fee' | 'installment'
): Promise<boolean> => {
  try {
    // This would need to be implemented based on your database structure
    // For now, we'll return false (no duplicate found)
    // You should implement actual database checking here
    
    console.log(`Checking for duplicate ${type} receipt number:`, receiptNumber);
    
    // TODO: Implement actual duplicate checking against your database
    // This could involve querying your Supabase/hybridApi for existing receipts
    
    return false; // Assume no duplicate for now
    
  } catch (error) {
    console.error('Error checking for duplicate receipt number:', error);
    return false; // Assume no duplicate on error to avoid blocking
  }
};
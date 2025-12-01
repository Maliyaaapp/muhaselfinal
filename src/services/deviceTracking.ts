/**
 * Device Tracking Service
 * Tracks which computer and Windows user performed each action
 * Provides complete audit trail for accountability
 */

export interface SystemInfo {
  computerName: string;
  username: string;
  platform: string;
  osVersion: string;
  osType: string;
  arch: string;
  totalMemory: number;
  freeMemory: number;
  cpus: number;
  networkInterfaces: string[];
  timestamp: string;
}

export interface DeviceInfo {
  computerName: string;
  windowsUsername: string;
  platform: string;
  osVersion: string;
  capturedAt: string;
}

export interface LoginSession {
  id?: string;
  userEmail: string;
  userName?: string;
  userRole?: string;
  computerName: string;
  windowsUsername: string;
  platform: string;
  osVersion: string;
  loginTime: string;
  schoolId?: string;
}

export interface PaymentDeviceInfo {
  computerName: string;
  windowsUsername: string;
  userEmail: string;
  userName?: string;
  timestamp: string;
}

class DeviceTrackingService {
  private cachedSystemInfo: SystemInfo | null = null;
  private currentSession: LoginSession | null = null;

  /**
   * Get system information from Electron
   */
  async getSystemInfo(): Promise<SystemInfo | null> {
    // Return cached info if available
    if (this.cachedSystemInfo) {
      return this.cachedSystemInfo;
    }

    try {
      // Debug logging
      console.log('🔍 Checking for Electron API...');
      console.log('window exists:', typeof window !== 'undefined');
      console.log('electronAPI exists:', typeof (window as any).electronAPI !== 'undefined');
      console.log('electronAPI keys:', (window as any).electronAPI ? Object.keys((window as any).electronAPI) : 'N/A');
      console.log('getSystemInfo exists:', typeof (window as any).electronAPI?.getSystemInfo === 'function');
      
      // Check if running in Electron
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getSystemInfo) {
        console.log('🔄 Calling getSystemInfo...');
        const response = await (window as any).electronAPI.getSystemInfo();
        console.log('📦 Response received:', response);
        
        if (response && response.success && response.data) {
          this.cachedSystemInfo = response.data;
          console.log('✅ System info retrieved:', {
            computerName: response.data.computerName,
            username: response.data.username,
            platform: response.data.platform
          });
          return response.data;
        } else {
          console.warn('⚠️ Response invalid:', response);
        }
      } else {
        console.warn('⚠️ electronAPI.getSystemInfo not available');
      }

      // Fallback for web browser
      console.warn('⚠️ Not running in Electron - device tracking unavailable');
      return null;
    } catch (error) {
      console.error('❌ Error getting system info:', error);
      return null;
    }
  }

  /**
   * Get simplified device info for database storage
   */
  async getDeviceInfo(): Promise<DeviceInfo | null> {
    const systemInfo = await this.getSystemInfo();
    
    if (!systemInfo) {
      return null;
    }

    return {
      computerName: systemInfo.computerName,
      windowsUsername: systemInfo.username,
      platform: systemInfo.platform,
      osVersion: systemInfo.osVersion,
      capturedAt: new Date().toISOString()
    };
  }

  /**
   * Create a login session record
   */
  async createLoginSession(
    userEmail: string,
    userName: string,
    userRole: string,
    schoolId: string
  ): Promise<LoginSession | null> {
    const deviceInfo = await this.getDeviceInfo();
    
    if (!deviceInfo) {
      console.warn('⚠️ Cannot create login session - device info unavailable');
      return null;
    }

    const session: LoginSession = {
      userEmail,
      userName,
      userRole,
      computerName: deviceInfo.computerName,
      windowsUsername: deviceInfo.windowsUsername,
      platform: deviceInfo.platform,
      osVersion: deviceInfo.osVersion,
      loginTime: new Date().toISOString(),
      schoolId
    };

    this.currentSession = session;

    console.log('📝 Login session created:', {
      email: userEmail,
      computer: deviceInfo.computerName,
      windowsUser: deviceInfo.windowsUsername
    });

    return session;
  }

  /**
   * Get current session info
   */
  getCurrentSession(): LoginSession | null {
    return this.currentSession;
  }

  /**
   * Get payment device info for transaction records
   */
  async getPaymentDeviceInfo(
    userEmail: string,
    userName?: string
  ): Promise<PaymentDeviceInfo | null> {
    const deviceInfo = await this.getDeviceInfo();
    
    if (!deviceInfo) {
      return null;
    }

    return {
      computerName: deviceInfo.computerName,
      windowsUsername: deviceInfo.windowsUsername,
      userEmail,
      userName,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format device info for display
   */
  formatDeviceInfo(deviceInfo: DeviceInfo | PaymentDeviceInfo): string {
    return `${deviceInfo.computerName} (${deviceInfo.windowsUsername})`;
  }

  /**
   * Check if device info matches expected user
   */
  isDeviceInfoSuspicious(
    expectedWindowsUser: string,
    actualWindowsUser: string
  ): boolean {
    return expectedWindowsUser.toLowerCase() !== actualWindowsUser.toLowerCase();
  }

  /**
   * Clear cached data (on logout)
   */
  clearCache(): void {
    this.currentSession = null;
    console.log('🗑️ Device tracking cache cleared');
  }
}

// Export singleton instance
export const deviceTracking = new DeviceTrackingService();

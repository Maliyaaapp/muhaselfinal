# 🖥️ Device Tracking System - Complete Accountability

## Overview
Complete device tracking system that records which computer and Windows user performed every action in the system. Provides full audit trail for accountability and security.

## What's Tracked

### 1. Login Sessions
Every login records:
- User email and name
- Computer name (hostname)
- Windows username
- Operating system details
- Login timestamp
- School ID

### 2. Payment Transactions
Every payment (fees and installments) records:
- Who made the payment (email, name, role)
- Which computer it came from
- Which Windows user made it
- When it was recorded
- All payment details

### 3. System Information
Captured from Electron:
- Computer name (hostname)
- Windows username
- Platform (Windows/Mac/Linux)
- OS version
- Architecture
- Memory info
- Network interfaces

## Implementation

### Step 1: Electron IPC Bridge
**File: `main.cjs`**
```javascript
ipcMain.handle('get-system-info', async () => {
  const os = require('os');
  return {
    computerName: os.hostname(),
    username: os.userInfo().username,
    platform: os.platform(),
    osVersion: os.release(),
    // ... more system info
  };
});
```

**File: `preload.ts`**
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  getSystemInfo: () => ipcRenderer.invoke('get-system-info')
});
```

### Step 2: Device Tracking Service
**File: `src/services/deviceTracking.ts`**

Provides:
- `getSystemInfo()` - Get full system information
- `getDeviceInfo()` - Get simplified device info for database
- `createLoginSession()` - Create login session record
- `getPaymentDeviceInfo()` - Get device info for payments
- `formatDeviceInfo()` - Format for display
- `isDeviceInfoSuspicious()` - Detect mismatches

### Step 3: Database Tables
**File: `create_device_tracking_tables.sql`**

#### login_sessions Table
```sql
CREATE TABLE login_sessions (
  id UUID PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_name TEXT,
  user_role TEXT,
  school_id UUID,
  computer_name TEXT NOT NULL,
  windows_username TEXT NOT NULL,
  platform TEXT NOT NULL,
  os_version TEXT,
  login_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Device Columns Added to Existing Tables
- `fees.paid_from_computer` - Computer name
- `fees.paid_by_windows_user` - Windows username
- `installments.paid_from_computer` - Computer name
- `installments.paid_by_windows_user` - Windows username

#### payment_audit_trail View
Combines all payments from fees and installments with device info:
```sql
CREATE VIEW payment_audit_trail AS
SELECT 
  f.id,
  'fee' as payment_type,
  f.student_name,
  f.paid_by as user_email,
  f.paid_from_computer as computer_name,
  f.paid_by_windows_user as windows_username,
  f.payment_recorded_at as timestamp
FROM fees WHERE f.paid > 0
UNION ALL
SELECT ... FROM installments WHERE i.paid_amount > 0
ORDER BY timestamp DESC;
```

### Step 4: API Functions
**File: `src/services/hybridApi.ts`**

Added functions:
- `saveLoginSession(session)` - Save login to database
- `getDeviceInfo()` - Get current device info
- `getPaymentAuditTrail(schoolId, daysBack)` - Get all payments with device info
- `getSuspiciousLogins(schoolId, daysBack)` - Find same email from different computers
- `getDeviceActivity(schoolId, computerName, daysBack)` - Get activity by device

### Step 5: Payment Integration
**File: `src/pages/school/fees/Fees.tsx`**

Every payment now captures device info:
```typescript
// Get device info
const deviceInfo = await hybridApi.getDeviceInfo();

// Add to payment record
const updatedFee = {
  // ... other fields
  paidBy: user?.email,
  paidFromComputer: deviceInfo?.computerName,
  paidByWindowsUser: deviceInfo?.windowsUsername,
  paymentRecordedAt: new Date().toISOString()
};
```

## Usage Examples

### Capture Login Session
```typescript
import { deviceTracking } from './services/deviceTracking';
import hybridApi from './services/hybridApi';

// On successful login
const session = await deviceTracking.createLoginSession(
  user.email,
  user.name,
  user.role,
  user.schoolId
);

// Save to database
await hybridApi.saveLoginSession(session);
```

### View Payment Audit Trail
```typescript
// Get all payments with device info
const response = await hybridApi.getPaymentAuditTrail(schoolId, 30);

response.data.forEach(payment => {
  console.log(`Payment by ${payment.user_email}`);
  console.log(`From: ${payment.computer_name} (${payment.windows_username})`);
  console.log(`Amount: ${payment.paid} OMR`);
});
```

### Detect Suspicious Activity
```typescript
// Find users logging in from multiple computers
const response = await hybridApi.getSuspiciousLogins(schoolId, 30);

response.data.forEach(user => {
  console.log(`⚠️ ${user.user_email} logged in from ${user.computer_count} different computers:`);
  console.log(`Computers: ${user.computers.join(', ')}`);
  console.log(`Windows users: ${user.windows_users.join(', ')}`);
});
```

### View Device Activity
```typescript
// Get activity for specific computer
const response = await hybridApi.getDeviceActivity(
  schoolId,
  'RECEPTION-PC',
  30
);

response.data.forEach(activity => {
  console.log(`${activity.activity_date}:`);
  console.log(`  ${activity.user_email} - ${activity.login_count} logins, ${activity.payment_count} payments`);
});
```

## Security Features

### 1. Complete Audit Trail
- Every action is traceable to a specific computer and Windows user
- Timestamps for all activities
- Cannot be modified after recording

### 2. Suspicious Activity Detection
- Detects same email from different computers
- Identifies Windows username mismatches
- Alerts for unusual patterns

### 3. Accountability
- Know exactly who did what from where
- Prevent unauthorized access
- Track colleague activity

### 4. RLS Policies
- Admins can only see their school's data
- Users can insert their own login sessions
- Secure by default

## What You'll See

### Login Tracking
```
✅ john@school.com logged in
   Computer: RECEPTION-PC
   Windows User: receptionist
   Time: 2024-12-01 10:30 AM
```

### Payment Tracking
```
💰 Payment of 100 OMR
   Made by: john@school.com
   From: RECEPTION-PC
   Windows User: receptionist
   Time: 2024-12-01 10:35 AM
```

### Suspicious Activity Alert
```
⚠️ ALERT: sara@school.com logged in from 2 different computers:
   - ADMIN-LAPTOP (administrator)
   - RECEPTION-PC (receptionist)
   
   This may indicate account sharing!
```

## Database Functions

### get_suspicious_logins(school_id, days_back)
Returns users who logged in from multiple computers:
- user_email
- computer_count
- computers[] (array of computer names)
- windows_users[] (array of Windows usernames)
- last_login

### get_device_activity(school_id, computer_name, days_back)
Returns activity by device:
- activity_date
- user_email
- computer_name
- windows_username
- login_count
- payment_count

## Setup Instructions

### 1. Run SQL Migration
```bash
# In Supabase SQL Editor, run:
create_device_tracking_tables.sql
```

### 2. Verify Tables Created
```sql
SELECT * FROM login_sessions LIMIT 1;
SELECT * FROM payment_audit_trail LIMIT 10;
```

### 3. Test Device Info
```typescript
// In browser console (Electron app)
const info = await window.electronAPI.getSystemInfo();
console.log(info);
```

### 4. Integrate with Login
Add to your login success handler:
```typescript
const session = await deviceTracking.createLoginSession(
  user.email,
  user.name,
  user.role,
  user.schoolId
);
await hybridApi.saveLoginSession(session);
```

## Benefits

✅ **Complete Accountability** - Know exactly who did what from where
✅ **Security** - Detect unauthorized access and account sharing
✅ **Audit Trail** - Full history of all activities
✅ **Compliance** - Meet audit requirements
✅ **Trust** - Build confidence in system integrity
✅ **Investigation** - Quickly trace any suspicious activity

## Next Steps

1. Run the SQL migration to create tables
2. Test device info capture in Electron
3. Integrate login session tracking
4. Verify payments include device info
5. Create admin dashboard to view audit trail
6. Set up alerts for suspicious activity

---

**Result:** Complete visibility into who is doing what from which computer. No more mystery about who made a payment or logged in from where!

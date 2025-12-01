# 🧪 Device Tracking Test Guide

## Quick Test Steps

### 1. Test System Info Capture

Open the Electron app and test in the browser console:

```javascript
// Test if system info is available
const info = await window.electronAPI.getSystemInfo();
console.log('System Info:', info);

// Expected output:
// {
//   success: true,
//   data: {
//     computerName: "YOUR-PC-NAME",
//     username: "your-windows-username",
//     platform: "win32",
//     osVersion: "10.0.19045",
//     ...
//   }
// }
```

### 2. Test Login Session Tracking

1. **Logout** if you're logged in
2. **Login** with your credentials
3. Check the browser console for:
   ```
   ✅ Login session tracked: {
     email: "your@email.com",
     computer: "YOUR-PC-NAME",
     windowsUser: "your-windows-username"
   }
   ```

4. **Check Supabase** - Go to Supabase SQL Editor and run:
   ```sql
   SELECT * FROM login_sessions ORDER BY login_time DESC LIMIT 10;
   ```

   You should see your login with computer name and Windows username!

### 3. Test Payment Device Tracking

1. Go to **Fees** page
2. Make a **partial payment** on any fee
3. Check the console for:
   ```
   🖥️ Device info: {
     computerName: "YOUR-PC-NAME",
     windowsUsername: "your-windows-username",
     ...
   }
   ```

4. **Check Supabase** - Run:
   ```sql
   SELECT 
     student_name,
     paid,
     paid_by,
     paid_from_computer,
     paid_by_windows_user,
     payment_recorded_at
   FROM fees 
   WHERE paid > 0 
   ORDER BY payment_recorded_at DESC 
   LIMIT 10;
   ```

   You should see the computer name and Windows username!

### 4. Test Audit Trail

In Supabase SQL Editor:

```sql
-- View all payments with device info
SELECT * FROM payment_audit_trail 
ORDER BY timestamp DESC 
LIMIT 20;
```

Expected columns:
- `user_email` - Who made the payment
- `computer_name` - Which computer
- `windows_username` - Which Windows user
- `timestamp` - When it happened

### 5. Test Suspicious Login Detection

```sql
-- Find users logging in from multiple computers
SELECT * FROM get_suspicious_logins(
  'YOUR-SCHOOL-ID'::UUID,  -- Replace with your school ID
  30  -- Last 30 days
);
```

This will show if any email logged in from different computers.

### 6. Test Device Activity

```sql
-- View activity by device
SELECT * FROM get_device_activity(
  'YOUR-SCHOOL-ID'::UUID,  -- Replace with your school ID
  NULL,  -- All computers (or specify 'COMPUTER-NAME')
  30  -- Last 30 days
);
```

Shows login and payment counts by device.

## Troubleshooting

### Issue: System info returns null

**Problem:** Not running in Electron or IPC not working

**Solution:**
1. Make sure you're running the Electron app (not web browser)
2. Check if `window.electronAPI` exists in console
3. Restart the Electron app

### Issue: Computer name is NULL in database

**Problem:** Device info not being captured

**Check:**
1. Console for errors during login
2. Make sure `getSystemInfo()` IPC handler is working
3. Verify preload script is loaded

**Fix:**
```javascript
// Test in console
const info = await window.electronAPI.getSystemInfo();
console.log(info);
```

If this returns null, the IPC bridge isn't working.

### Issue: Login sessions table is empty

**Problem:** Login tracking not integrated

**Check:**
1. Look for console message: `✅ Login session tracked`
2. Check for errors in console during login
3. Verify you're logged in successfully

**Manual Test:**
```javascript
// In console after login
import { deviceTracking } from './services/deviceTracking';
import hybridApi from './services/hybridApi';

const session = await deviceTracking.createLoginSession(
  'test@example.com',
  'Test User',
  'admin',
  'school-id-here'
);

const result = await hybridApi.saveLoginSession(session);
console.log(result);
```

### Issue: Payment device info is NULL

**Problem:** Device info not being passed to payment save

**Check:**
1. Look for console message: `🖥️ Device info:` during payment
2. Verify the payment was made in Electron (not web)
3. Check if `deviceInfo` variable is populated

## Expected Results

### ✅ Successful Setup

After successful setup, you should see:

**1. Login Sessions Table:**
```
| user_email        | computer_name  | windows_username | login_time          |
|-------------------|----------------|------------------|---------------------|
| admin@school.com  | ADMIN-PC       | administrator    | 2024-12-01 10:30:00 |
| john@school.com   | RECEPTION-PC   | receptionist     | 2024-12-01 10:35:00 |
```

**2. Fees Table (with device info):**
```
| student_name | paid | paid_by          | paid_from_computer | paid_by_windows_user |
|--------------|------|------------------|--------------------|----------------------|
| Ahmed Ali    | 100  | john@school.com  | RECEPTION-PC       | receptionist         |
```

**3. Payment Audit Trail:**
```
| payment_type | user_email       | computer_name | windows_username | timestamp           |
|--------------|------------------|---------------|------------------|---------------------|
| fee          | john@school.com  | RECEPTION-PC  | receptionist     | 2024-12-01 10:40:00 |
| installment  | sara@school.com  | ADMIN-LAPTOP  | administrator    | 2024-12-01 11:00:00 |
```

## Next Steps

Once everything is working:

1. **Create Admin Dashboard** - Show audit trail in the UI
2. **Add Alerts** - Notify admins of suspicious logins
3. **Export Reports** - Generate device activity reports
4. **Monitor Usage** - Track which computers are most active

---

**You now have complete accountability for every action in your system!** 🎯

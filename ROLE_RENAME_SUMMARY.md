# 📝 Role Rename: School Manager → Chief Financial Officer

## Changes Made

### Arabic Translation
- **Old:** مدير المدرسة (School Manager)
- **New:** المدير المالي (Chief Financial Officer / CFO)

### Files Updated

#### Frontend Components
1. ✅ `src/components/school/Sidebar.tsx` - Sidebar role display (2 locations)
2. ✅ `src/pages/school/tracker/Tracker.tsx` - Role labels and filter dropdown
3. ✅ `src/pages/school/fees/Fees.tsx` - Payment tracking role display
4. ✅ `src/pages/school/installments/Installments.tsx` - Payment tracking role display
5. ✅ `src/pages/school/communications/Communications.tsx` - Message sender role display
6. ✅ `src/pages/admin/subscriptions/SubscriptionsList.tsx` - Subscription notification role
7. ✅ `src/utils/initialData.ts` - Initial data seed

#### Database
8. ✅ `rename_school_manager_to_cfo.sql` - Complete SQL migration script

## SQL Migration

Run this in Supabase SQL Editor:

```sql
-- File: rename_school_manager_to_cfo.sql
```

### What the SQL Does:

1. **Updates accounts table** - Changes user names containing "مدير المدرسة" to "المدير المالي"
2. **Updates login_sessions** - Changes role names in login history
3. **Updates fees table** - Updates payment tracking records
4. **Updates installments table** - Updates payment tracking records
5. **Updates messages table** - Updates message sender roles
6. **Creates helper function** - `get_role_display_name(role_code, lang)` for consistent role display

### Helper Function Usage:

```sql
-- Get Arabic role name
SELECT get_role_display_name('schoolAdmin', 'ar');
-- Returns: المدير المالي

-- Get English role name
SELECT get_role_display_name('schoolAdmin', 'en');
-- Returns: Chief Financial Officer
```

## Role Code Mapping

The role **code** remains `schoolAdmin` in the database, only the **display name** changes:

| Role Code | Old Display (AR) | New Display (AR) | English Display |
|-----------|------------------|------------------|-----------------|
| `admin` | مدير النظام | مدير النظام | System Administrator |
| `schoolAdmin` | مدير المدرسة | **المدير المالي** | **Chief Financial Officer** |
| `gradeManager` | مدير الصف | مدير الصف | Grade Manager |
| `teacher` | معلم | معلم | Teacher |

## Testing Checklist

### Admin Portal
- [ ] Check user list - role displays as "المدير المالي"
- [ ] Check subscriptions - notification role shows "المدير المالي"

### School Portal
- [ ] Sidebar shows "المدير المالي" for schoolAdmin users
- [ ] Tracker page shows "المدير المالي" in role column
- [ ] Tracker filter dropdown shows "المدير المالي"
- [ ] Fees page payment info shows "المدير المالي"
- [ ] Installments page payment info shows "المدير المالي"
- [ ] Communications page sender role shows "المدير المالي"

### Database
- [ ] Run SQL migration successfully
- [ ] Verify accounts table updated
- [ ] Verify login_sessions updated
- [ ] Verify fees table updated
- [ ] Verify installments table updated
- [ ] Test helper function: `SELECT get_role_display_name('schoolAdmin', 'ar');`

## Verification Queries

```sql
-- Check accounts
SELECT name, role FROM accounts WHERE role = 'schoolAdmin' LIMIT 5;

-- Check login sessions
SELECT user_name, user_role FROM login_sessions 
WHERE user_role LIKE '%Financial%' OR user_name LIKE '%المدير المالي%'
ORDER BY login_time DESC LIMIT 5;

-- Check fees
SELECT student_name, paid_by, paid_by_role FROM fees 
WHERE paid_by_role = 'Chief Financial Officer' 
ORDER BY payment_recorded_at DESC LIMIT 5;

-- Check installments
SELECT student_name, paid_by, paid_by_role FROM installments 
WHERE paid_by_role = 'Chief Financial Officer' 
ORDER BY payment_recorded_at DESC LIMIT 5;

-- Test helper function
SELECT 
  get_role_display_name('schoolAdmin', 'ar') as arabic_name,
  get_role_display_name('schoolAdmin', 'en') as english_name;
```

## Rollback (if needed)

If you need to revert the changes:

```sql
-- Rollback accounts
UPDATE accounts 
SET name = REPLACE(name, 'المدير المالي', 'مدير المدرسة')
WHERE name LIKE '%المدير المالي%';

-- Rollback login_sessions
UPDATE login_sessions 
SET user_role = 'School Manager'
WHERE user_role = 'Chief Financial Officer';

-- Rollback fees
UPDATE fees 
SET paid_by_role = 'schoolAdmin'
WHERE paid_by_role = 'Chief Financial Officer';

-- Rollback installments
UPDATE installments 
SET paid_by_role = 'schoolAdmin'
WHERE paid_by_role = 'Chief Financial Officer';
```

## Notes

- The role **code** (`schoolAdmin`) remains unchanged in the database
- Only the **display names** are updated
- All historical records are updated to show the new role name
- The helper function provides consistent role display across the application
- No breaking changes to authentication or permissions

---

**Status:** ✅ Ready to deploy
**Impact:** Display names only - no functional changes
**Risk:** Low - only affects UI labels

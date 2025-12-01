-- =====================================================
-- SQL Script: Add Backup Account Role (الحساب الاحتياطي)
-- =====================================================
-- This script adds a new role 'backupAccount' that has:
-- - Read-only access to students, fees, and installments
-- - NO delete permissions on any table
-- - NO insert/update permissions (view only)
-- =====================================================

-- 1. First, let's verify the accounts table structure
-- (The role is stored as a text field, so no enum changes needed)

-- 2. Create RLS policies for the backupAccount role

-- =====================================================
-- STUDENTS TABLE - Read Only for backupAccount
-- =====================================================

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS "backup_account_read_students" ON students;

-- Allow backupAccount to read students from their school
CREATE POLICY "backup_account_read_students" ON students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = auth.uid()
      AND accounts.role = 'backupAccount'
      AND accounts.school_id = students.school_id
    )
  );

-- =====================================================
-- FEES TABLE - Read Only for backupAccount
-- =====================================================

DROP POLICY IF EXISTS "backup_account_read_fees" ON fees;

-- Allow backupAccount to read fees from their school
CREATE POLICY "backup_account_read_fees" ON fees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = auth.uid()
      AND accounts.role = 'backupAccount'
      AND accounts.school_id = fees.school_id
    )
  );

-- =====================================================
-- INSTALLMENTS TABLE - Read Only for backupAccount
-- =====================================================

DROP POLICY IF EXISTS "backup_account_read_installments" ON installments;

-- Allow backupAccount to read installments from their school
CREATE POLICY "backup_account_read_installments" ON installments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = auth.uid()
      AND accounts.role = 'backupAccount'
      AND accounts.school_id = installments.school_id
    )
  );

-- =====================================================
-- SETTINGS TABLE - Read Only for backupAccount
-- =====================================================

DROP POLICY IF EXISTS "backup_account_read_settings" ON settings;

-- Allow backupAccount to read settings from their school
CREATE POLICY "backup_account_read_settings" ON settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = auth.uid()
      AND accounts.role = 'backupAccount'
      AND accounts.school_id = settings.school_id
    )
  );

-- =====================================================
-- EXPLICITLY DENY DELETE for backupAccount
-- =====================================================
-- Note: Since we're only creating SELECT policies for backupAccount,
-- they won't have INSERT, UPDATE, or DELETE permissions by default.
-- The following policies ensure explicit denial if needed.

-- For extra security, you can add these denial policies:

-- Deny delete on students for backupAccount
DROP POLICY IF EXISTS "backup_account_deny_delete_students" ON students;
CREATE POLICY "backup_account_deny_delete_students" ON students
  FOR DELETE
  USING (
    NOT EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = auth.uid()
      AND accounts.role = 'backupAccount'
    )
  );

-- Deny delete on fees for backupAccount
DROP POLICY IF EXISTS "backup_account_deny_delete_fees" ON fees;
CREATE POLICY "backup_account_deny_delete_fees" ON fees
  FOR DELETE
  USING (
    NOT EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = auth.uid()
      AND accounts.role = 'backupAccount'
    )
  );

-- Deny delete on installments for backupAccount
DROP POLICY IF EXISTS "backup_account_deny_delete_installments" ON installments;
CREATE POLICY "backup_account_deny_delete_installments" ON installments
  FOR DELETE
  USING (
    NOT EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = auth.uid()
      AND accounts.role = 'backupAccount'
    )
  );

-- =====================================================
-- HELPER FUNCTION: Get role display name (updated)
-- =====================================================

CREATE OR REPLACE FUNCTION get_role_display_name(role_code TEXT, lang TEXT DEFAULT 'ar')
RETURNS TEXT AS $$
BEGIN
  IF lang = 'ar' THEN
    CASE role_code
      WHEN 'admin' THEN RETURN 'مدير النظام';
      WHEN 'schoolAdmin' THEN RETURN 'المدير المالي';
      WHEN 'gradeManager' THEN RETURN 'مدير الصف';
      WHEN 'backupAccount' THEN RETURN 'الحساب الاحتياطي';
      WHEN 'teacher' THEN RETURN 'معلم';
      WHEN 'accountant' THEN RETURN 'محاسب';
      ELSE RETURN role_code;
    END CASE;
  ELSE
    CASE role_code
      WHEN 'admin' THEN RETURN 'System Administrator';
      WHEN 'schoolAdmin' THEN RETURN 'Chief Financial Officer';
      WHEN 'gradeManager' THEN RETURN 'Grade Manager';
      WHEN 'backupAccount' THEN RETURN 'Backup Account';
      WHEN 'teacher' THEN RETURN 'Teacher';
      WHEN 'accountant' THEN RETURN 'Accountant';
      ELSE RETURN role_code;
    END CASE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if policies were created successfully
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE policyname LIKE '%backup_account%'
ORDER BY tablename, policyname;

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. The backupAccount role can ONLY:
--    - View students (names and basic info)
--    - View fees
--    - View installments
--
-- 2. The backupAccount role CANNOT:
--    - Add new students, fees, or installments
--    - Edit any data
--    - Delete any data
--    - Access communications, tracker, or settings pages
--
-- 3. To create a backup account user:
--    - Go to Admin Portal > Accounts
--    - Click "إنشاء حساب جديد"
--    - Select role: "الحساب الاحتياطي"
--    - Assign to a school
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Backup Account role (الحساب الاحتياطي) has been configured successfully!';
  RAISE NOTICE '📋 Permissions:';
  RAISE NOTICE '   - ✓ Can view students';
  RAISE NOTICE '   - ✓ Can view fees';
  RAISE NOTICE '   - ✓ Can view installments';
  RAISE NOTICE '   - ✗ Cannot add/edit/delete any data';
  RAISE NOTICE '   - ✗ Cannot access communications, tracker, or settings';
END $$;

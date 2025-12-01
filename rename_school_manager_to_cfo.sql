-- ============================================
-- RENAME SCHOOL MANAGER TO CHIEF FINANCIAL OFFICER
-- Updates all references in database
-- ============================================

-- 1. Update accounts table - change display names
UPDATE accounts 
SET name = REPLACE(name, 'مدير المدرسة', 'المدير المالي')
WHERE name LIKE '%مدير المدرسة%';

UPDATE accounts 
SET name = REPLACE(name, 'School Manager', 'Chief Financial Officer')
WHERE name LIKE '%School Manager%';

-- 2. Update any stored role descriptions (if they exist in your schema)
-- Note: This assumes you might have role descriptions stored somewhere
-- Adjust table names as needed

-- 3. Update login_sessions table (if role names are stored)
UPDATE login_sessions 
SET user_role = 'Chief Financial Officer'
WHERE user_role = 'School Manager';

UPDATE login_sessions 
SET user_name = REPLACE(user_name, 'مدير المدرسة', 'المدير المالي')
WHERE user_name LIKE '%مدير المدرسة%';

-- 4. Update fees table - payment tracking
UPDATE fees 
SET paid_by_role = 'Chief Financial Officer'
WHERE paid_by_role = 'School Manager' OR paid_by_role = 'schoolAdmin';

UPDATE fees 
SET paid_by = REPLACE(paid_by, 'مدير المدرسة', 'المدير المالي')
WHERE paid_by LIKE '%مدير المدرسة%';

-- 5. Update installments table - payment tracking
UPDATE installments 
SET paid_by_role = 'Chief Financial Officer'
WHERE paid_by_role = 'School Manager' OR paid_by_role = 'schoolAdmin';

UPDATE installments 
SET paid_by = REPLACE(paid_by, 'مدير المدرسة', 'المدير المالي')
WHERE paid_by LIKE '%مدير المدرسة%';

-- 6. Update messages table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    EXECUTE 'UPDATE messages 
             SET sent_by_role = ''Chief Financial Officer''
             WHERE sent_by_role = ''School Manager'' OR sent_by_role = ''schoolAdmin''';
    
    EXECUTE 'UPDATE messages 
             SET sent_by = REPLACE(sent_by, ''مدير المدرسة'', ''المدير المالي'')
             WHERE sent_by LIKE ''%مدير المدرسة%''';
  END IF;
END $$;

-- 7. Create a function to get role display name (for consistency)
CREATE OR REPLACE FUNCTION get_role_display_name(role_code TEXT, lang TEXT DEFAULT 'ar')
RETURNS TEXT AS $$
BEGIN
  IF lang = 'ar' THEN
    CASE role_code
      WHEN 'admin' THEN RETURN 'مدير النظام';
      WHEN 'schoolAdmin' THEN RETURN 'المدير المالي';
      WHEN 'gradeManager' THEN RETURN 'مدير الصف';
      WHEN 'teacher' THEN RETURN 'معلم';
      ELSE RETURN role_code;
    END CASE;
  ELSE
    CASE role_code
      WHEN 'admin' THEN RETURN 'System Administrator';
      WHEN 'schoolAdmin' THEN RETURN 'Chief Financial Officer';
      WHEN 'gradeManager' THEN RETURN 'Grade Manager';
      WHEN 'teacher' THEN RETURN 'Teacher';
      ELSE RETURN role_code;
    END CASE;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. Grant execute permission
GRANT EXECUTE ON FUNCTION get_role_display_name TO authenticated;

-- 9. Verify changes
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Role names updated successfully!';
  RAISE NOTICE '📊 Summary:';
  RAISE NOTICE '   - schoolAdmin role now displays as: المدير المالي (Arabic) / Chief Financial Officer (English)';
  RAISE NOTICE '   - All historical records updated';
  RAISE NOTICE '   - Helper function created: get_role_display_name(role_code, lang)';
END $$;

-- 10. Show sample of updated records
SELECT 'Updated Accounts' as table_name, COUNT(*) as count
FROM accounts 
WHERE name LIKE '%المدير المالي%'
UNION ALL
SELECT 'Updated Login Sessions', COUNT(*)
FROM login_sessions 
WHERE user_role = 'Chief Financial Officer'
UNION ALL
SELECT 'Updated Fees', COUNT(*)
FROM fees 
WHERE paid_by_role = 'Chief Financial Officer'
UNION ALL
SELECT 'Updated Installments', COUNT(*)
FROM installments 
WHERE paid_by_role = 'Chief Financial Officer';

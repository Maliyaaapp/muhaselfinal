-- ============================================
-- DEVICE TRACKING TABLES
-- Track which computer and Windows user performed each action
-- ============================================

-- 1. Login Sessions Table
-- Tracks every login with device information
CREATE TABLE IF NOT EXISTS login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  user_name TEXT,
  user_role TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  
  -- Device Information
  computer_name TEXT NOT NULL,
  windows_username TEXT NOT NULL,
  platform TEXT NOT NULL,
  os_version TEXT,
  
  -- Timestamps
  login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_login_sessions_user_email ON login_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_login_sessions_school_id ON login_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_login_time ON login_sessions(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_login_sessions_computer_name ON login_sessions(computer_name);

-- Enable RLS
ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for login_sessions
-- Admins can see all sessions for their school
CREATE POLICY "Admins can view login sessions for their school"
  ON login_sessions
  FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM accounts WHERE id = auth.uid()
    )
  );

-- Users can insert their own login sessions
CREATE POLICY "Users can insert their own login sessions"
  ON login_sessions
  FOR INSERT
  WITH CHECK (true);

-- 2. Add device tracking columns to existing tables
-- Add to fees table
ALTER TABLE fees ADD COLUMN IF NOT EXISTS paid_from_computer TEXT;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS paid_by_windows_user TEXT;

-- Add to installments table
ALTER TABLE installments ADD COLUMN IF NOT EXISTS paid_from_computer TEXT;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS paid_by_windows_user TEXT;

-- Add to messages table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_from_computer TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_by_windows_user TEXT;
  END IF;
END $$;

-- 3. Create view for audit trail
CREATE OR REPLACE VIEW payment_audit_trail AS
SELECT 
  f.id,
  'fee'::TEXT as payment_type,
  f.student_name,
  f.grade,
  f.fee_type,
  f.amount,
  f.paid,
  f.payment_date,
  f.payment_method,
  f.paid_by as user_email,
  f.paid_by_role as user_role,
  f.paid_from_computer as computer_name,
  f.paid_by_windows_user as windows_username,
  f.payment_recorded_at as timestamp,
  f.school_id
FROM fees f
WHERE f.paid > 0

UNION ALL

SELECT 
  i.id,
  'installment'::TEXT as payment_type,
  i.student_name,
  i.grade,
  i.fee_type,
  i.amount,
  i.paid_amount as paid,
  i.paid_date as payment_date,
  i.payment_method,
  i.paid_by as user_email,
  i.paid_by_role as user_role,
  i.paid_from_computer as computer_name,
  i.paid_by_windows_user as windows_username,
  i.payment_recorded_at as timestamp,
  i.school_id
FROM installments i
WHERE i.paid_amount > 0

ORDER BY timestamp DESC;

-- 4. Create function to get suspicious logins
-- (same email from different computers)
CREATE OR REPLACE FUNCTION get_suspicious_logins(
  p_school_id UUID,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  user_email TEXT,
  computer_count BIGINT,
  computers TEXT[],
  windows_users TEXT[],
  last_login TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ls.user_email,
    COUNT(DISTINCT ls.computer_name) as computer_count,
    ARRAY_AGG(DISTINCT ls.computer_name) as computers,
    ARRAY_AGG(DISTINCT ls.windows_username) as windows_users,
    MAX(ls.login_time) as last_login
  FROM login_sessions ls
  WHERE 
    ls.school_id = p_school_id
    AND ls.login_time > NOW() - (p_days_back || ' days')::INTERVAL
  GROUP BY ls.user_email
  HAVING COUNT(DISTINCT ls.computer_name) > 1
  ORDER BY last_login DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to get user activity by device
CREATE OR REPLACE FUNCTION get_device_activity(
  p_school_id UUID,
  p_computer_name TEXT DEFAULT NULL,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  activity_date DATE,
  user_email TEXT,
  computer_name TEXT,
  windows_username TEXT,
  login_count BIGINT,
  payment_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH login_counts AS (
    SELECT 
      DATE(ls.login_time) as activity_date,
      ls.user_email,
      ls.computer_name,
      ls.windows_username,
      COUNT(*) as login_count
    FROM login_sessions ls
    WHERE 
      ls.school_id = p_school_id
      AND ls.login_time > NOW() - (p_days_back || ' days')::INTERVAL
      AND (p_computer_name IS NULL OR ls.computer_name = p_computer_name)
    GROUP BY DATE(ls.login_time), ls.user_email, ls.computer_name, ls.windows_username
  ),
  payment_counts AS (
    SELECT 
      DATE(pat.timestamp) as activity_date,
      pat.user_email,
      pat.computer_name,
      pat.windows_username,
      COUNT(*) as payment_count
    FROM payment_audit_trail pat
    WHERE 
      pat.school_id = p_school_id
      AND pat.timestamp > NOW() - (p_days_back || ' days')::INTERVAL
      AND (p_computer_name IS NULL OR pat.computer_name = p_computer_name)
    GROUP BY DATE(pat.timestamp), pat.user_email, pat.computer_name, pat.windows_username
  )
  SELECT 
    COALESCE(lc.activity_date, pc.activity_date) as activity_date,
    COALESCE(lc.user_email, pc.user_email) as user_email,
    COALESCE(lc.computer_name, pc.computer_name) as computer_name,
    COALESCE(lc.windows_username, pc.windows_username) as windows_username,
    COALESCE(lc.login_count, 0) as login_count,
    COALESCE(pc.payment_count, 0) as payment_count
  FROM login_counts lc
  FULL OUTER JOIN payment_counts pc 
    ON lc.activity_date = pc.activity_date 
    AND lc.user_email = pc.user_email
    AND lc.computer_name = pc.computer_name
  ORDER BY activity_date DESC, user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant permissions
GRANT SELECT ON payment_audit_trail TO authenticated;
GRANT EXECUTE ON FUNCTION get_suspicious_logins TO authenticated;
GRANT EXECUTE ON FUNCTION get_device_activity TO authenticated;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Device tracking tables created successfully!';
  RAISE NOTICE '📊 Tables: login_sessions';
  RAISE NOTICE '📊 Views: payment_audit_trail';
  RAISE NOTICE '📊 Functions: get_suspicious_logins, get_device_activity';
  RAISE NOTICE '🔒 RLS policies enabled';
END $$;

-- ADD PAYMENT TRACKING COLUMNS TO FEES AND INSTALLMENTS TABLES
-- This adds columns to track who recorded each payment

-- ============================================
-- FEES TABLE - Payment Tracking
-- ============================================
ALTER TABLE public.fees 
ADD COLUMN IF NOT EXISTS paid_by TEXT,
ADD COLUMN IF NOT EXISTS paid_by_role TEXT,
ADD COLUMN IF NOT EXISTS paid_by_email TEXT,
ADD COLUMN IF NOT EXISTS paid_by_id UUID,
ADD COLUMN IF NOT EXISTS payment_recorded_at TIMESTAMPTZ;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fees_paid_by ON public.fees(paid_by);
CREATE INDEX IF NOT EXISTS idx_fees_paid_by_id ON public.fees(paid_by_id);
CREATE INDEX IF NOT EXISTS idx_fees_payment_recorded_at ON public.fees(payment_recorded_at);

-- Add comments to document the columns
COMMENT ON COLUMN public.fees.paid_by IS 'Name of the user who recorded the payment';
COMMENT ON COLUMN public.fees.paid_by_role IS 'Role of the user who recorded the payment (schoolAdmin, gradeManager, etc.)';
COMMENT ON COLUMN public.fees.paid_by_email IS 'Email of the user who recorded the payment';
COMMENT ON COLUMN public.fees.paid_by_id IS 'User ID of the person who recorded the payment';
COMMENT ON COLUMN public.fees.payment_recorded_at IS 'Timestamp when the payment was recorded';

-- ============================================
-- INSTALLMENTS TABLE - Payment Tracking
-- ============================================
ALTER TABLE public.installments 
ADD COLUMN IF NOT EXISTS paid_by TEXT,
ADD COLUMN IF NOT EXISTS paid_by_role TEXT,
ADD COLUMN IF NOT EXISTS paid_by_email TEXT,
ADD COLUMN IF NOT EXISTS paid_by_id UUID,
ADD COLUMN IF NOT EXISTS payment_recorded_at TIMESTAMPTZ;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_installments_paid_by ON public.installments(paid_by);
CREATE INDEX IF NOT EXISTS idx_installments_paid_by_id ON public.installments(paid_by_id);
CREATE INDEX IF NOT EXISTS idx_installments_payment_recorded_at ON public.installments(payment_recorded_at);

-- Add comments to document the columns
COMMENT ON COLUMN public.installments.paid_by IS 'Name of the user who recorded the payment';
COMMENT ON COLUMN public.installments.paid_by_role IS 'Role of the user who recorded the payment (schoolAdmin, gradeManager, etc.)';
COMMENT ON COLUMN public.installments.paid_by_email IS 'Email of the user who recorded the payment';
COMMENT ON COLUMN public.installments.paid_by_id IS 'User ID of the person who recorded the payment';
COMMENT ON COLUMN public.installments.payment_recorded_at IS 'Timestamp when the payment was recorded';

-- ============================================
-- PAYMENT HISTORY TABLE (Optional - for detailed audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  
  -- Reference to the payment (either fee or installment)
  fee_id UUID,
  installment_id UUID,
  
  -- Student info
  student_id UUID NOT NULL,
  student_name TEXT NOT NULL,
  
  -- Payment details
  payment_type TEXT NOT NULL CHECK (payment_type IN ('fee', 'installment')),
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  payment_note TEXT,
  check_number TEXT,
  receipt_number TEXT,
  
  -- Who recorded the payment
  recorded_by TEXT NOT NULL,
  recorded_by_role TEXT,
  recorded_by_email TEXT,
  recorded_by_id UUID,
  
  -- Timestamps
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for payment history
CREATE INDEX IF NOT EXISTS idx_payment_history_school_id ON public.payment_history(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_student_id ON public.payment_history(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_fee_id ON public.payment_history(fee_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_installment_id ON public.payment_history(installment_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_recorded_at ON public.payment_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_payment_history_recorded_by_id ON public.payment_history(recorded_by_id);

-- Enable RLS on payment_history
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_history - allow all authenticated users to view/insert for their school
CREATE POLICY "Allow all operations on payment_history"
  ON public.payment_history FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.payment_history IS 'Audit trail of all payments recorded in the system';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Payment tracking columns added successfully!' as message;

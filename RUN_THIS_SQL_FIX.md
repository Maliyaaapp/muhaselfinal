# Fix for PGRST204 Error - Missing 'paidBy' Column

## Problem
The application is trying to update the `paid_by` column in the `installments` table, but this column doesn't exist in your database yet.

## Solution
Run the SQL migration file to add the missing columns.

## Steps to Fix

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the contents of `add_payment_tracking.sql` file
5. Click "Run" to execute the SQL
6. You should see: "Payment tracking columns added successfully!"

### Option 2: Using Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db push
```

### Option 3: Manual SQL Execution
Run this SQL directly in your database:

```sql
-- Add payment tracking columns to installments table
ALTER TABLE public.installments 
ADD COLUMN IF NOT EXISTS paid_by TEXT,
ADD COLUMN IF NOT EXISTS paid_by_role TEXT,
ADD COLUMN IF NOT EXISTS paid_by_email TEXT,
ADD COLUMN IF NOT EXISTS paid_by_id UUID,
ADD COLUMN IF NOT EXISTS payment_recorded_at TIMESTAMPTZ;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_installments_paid_by ON public.installments(paid_by);
CREATE INDEX IF NOT EXISTS idx_installments_paid_by_id ON public.installments(paid_by_id);
CREATE INDEX IF NOT EXISTS idx_installments_payment_recorded_at ON public.installments(payment_recorded_at);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
```

## After Running the SQL
1. Refresh your application
2. Try the partial payment operation again
3. The error should be resolved

## What These Columns Do
These columns track who recorded each payment:
- `paid_by`: Name of the user who recorded the payment
- `paid_by_role`: Role of the user (schoolAdmin, gradeManager, etc.)
- `paid_by_email`: Email of the user
- `paid_by_id`: User ID reference
- `payment_recorded_at`: Timestamp when payment was recorded

This provides an audit trail for all payment transactions.

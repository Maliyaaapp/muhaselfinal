-- Add installment_interval column to installments table
-- This column stores the interval in months between installments (1=monthly, 2=every 2 months, etc.)

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'installments' AND column_name = 'installment_interval'
    ) THEN
        ALTER TABLE installments ADD COLUMN installment_interval INTEGER DEFAULT 1;
        COMMENT ON COLUMN installments.installment_interval IS 'Interval in months between installments (1=monthly, 2=every 2 months, 3=quarterly, etc.)';
    END IF;
END $$;

-- Update existing records to have default value of 1 (monthly)
UPDATE installments SET installment_interval = 1 WHERE installment_interval IS NULL;

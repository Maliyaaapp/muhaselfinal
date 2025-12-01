# Installment Linking Fix for Combined Fees

## Problem
When making partial payments on combined fees (transportation_and_tuition), the installments were not being found or updated because:
1. Existing installments in the database don't have the `fee_id` column set
2. The auto-linking logic wasn't checking both camelCase and snake_case field names
3. After payment, the UI wasn't refreshing to show updated values

## Root Cause
- Installments created before the `fee_id` column was added don't have this field populated
- The query `getInstallments(undefined, undefined, selectedFee.id)` returns empty because `fee_id` is null
- The auto-linking logic was only checking `inst.feeId` but not `inst.fee_id`

## Solution

### 1. Enhanced Auto-Linking Logic
Updated the installment matching to check both camelCase and snake_case:
```typescript
const matchedInstallments = allStudentInstallments.filter((inst: any) => {
  const instFeeType = inst.feeType || inst.fee_type;
  const instFeeId = inst.feeId || inst.fee_id;
  const selectedFeeType = selectedFee.feeType || selectedFee.fee_type;
  
  return instFeeType === selectedFeeType && !instFeeId;
});
```

### 2. Improved Linking Process
When linking installments to fees, now sets both camelCase and snake_case:
```typescript
const updateData = {
  ...inst,
  feeId: selectedFee.id,
  fee_id: selectedFee.id,
  studentId: selectedFee.studentId,
  student_id: selectedFee.studentId,
  schoolId: user?.schoolId,
  school_id: user?.schoolId
};
```

### 3. Added Data Refresh
After successful payment, the fees data is now refreshed:
```typescript
await fetchData();
```

## Benefits
- ✅ Automatically links unlinked installments to their parent fees
- ✅ Works with both old and new data formats (camelCase and snake_case)
- ✅ UI updates immediately after payment
- ✅ Combined fees now work the same as regular fees
- ✅ Better debugging with detailed console logs

## Testing
1. Make a partial payment on a combined fee
2. Check console logs for:
   - "📋 Found unlinked installments (no fee_id): X"
   - "🔗 Linking installment: ..."
   - "✅ Linked: ..."
3. Verify the installments are updated in the Installments page
4. Verify the fee balance is updated correctly

## Migration Note
For existing installations with unlinked installments:
- The auto-linking will happen automatically on the first partial payment
- No manual database migration needed
- The linking is permanent once done

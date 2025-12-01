# Missing Installments Fix for Combined Fees

## Problem
When making partial payments on combined fees, the system reported:
- "📦 Total student installments: 0"
- "⚠️ No installments found for this fee - updating fee directly"
- Payments were being applied to the fee but not distributed across installments

## Root Cause
Some combined fees in the database don't have associated installments because:
1. They were created with `installments = 1` (no installment plan)
2. They were created before the installment feature was fully implemented
3. The installments were accidentally deleted

## Solution

### 1. Added `createInstallmentPlan` to hybridApi.ts
Created a new function that:
- Takes a fee and creates N installments
- Distributes the fee amount evenly across installments
- Sets proper due dates (monthly intervals)
- Links installments to the fee with `fee_id`
- Saves each installment to the database

### 2. Auto-Create Installments on Payment
Updated the payment handler in Fees.tsx to:
- Check if installments exist for the fee
- If NO installments exist at all, automatically create them
- Default to 9 monthly installments
- Then proceed with the payment distribution

### Code Flow
```typescript
// 1. Try to find installments by fee_id
let installments = await getInstallments(undefined, undefined, feeId);

// 2. If none found, try to find unlinked installments
if (installments.length === 0) {
  const allStudentInstallments = await getInstallments(undefined, studentId);
  const unlinked = allStudentInstallments.filter(i => !i.feeId && i.feeType === fee.feeType);
  
  // 3. If still none found, CREATE them
  if (unlinked.length === 0 && allStudentInstallments.length === 0) {
    await createInstallmentPlan(fee, 9, 1);
    installments = await getInstallments(undefined, undefined, feeId);
  }
}

// 4. Now distribute payment across installments
```

## Benefits
- ✅ Automatically fixes missing installments on-the-fly
- ✅ No manual database migration needed
- ✅ Works for both old and new fees
- ✅ Payments are properly distributed across installments
- ✅ Installments page shows correct data

## Testing
1. Find a combined fee with no installments
2. Try to make a partial payment
3. Check console logs for:
   - "🔧 No installments exist for this student - creating installment plan..."
   - "✅ Created 9 installments"
   - "✅ Loaded 9 newly created installments"
4. Verify payment is distributed across installments
5. Check Installments page to see the newly created installments

## Notes
- Default installment count is 9 (can be adjusted)
- Installments are created with monthly intervals
- First installment uses the fee's due date
- All installments are linked to the fee with `fee_id`

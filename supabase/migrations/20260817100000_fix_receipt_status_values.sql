-- Fix receipt statuses written with verb form (approve/reject) instead of
-- stored form (approved/rejected) by an earlier buggy reviewReceipt.
UPDATE public.payment_receipts
SET status = CASE
  WHEN status = 'approve' THEN 'approved'
  WHEN status = 'reject' THEN 'rejected'
  ELSE status
END
WHERE status IN ('approve', 'reject');
-- 0043 — store the price the lead was actually promised at click time.
-- UpgradeModal locks the sale price (first month ₪29/₪9) and sends it to
-- notify-lead, which dropped it — so payment-instruction emails demanded the
-- FULL price (₪59) from customers promised ₪29.

alter table public.leads
  add column if not exists price numeric;

-- supabase/migrations/20260524140002_formations_bpf_columns.sql

ALTER TABLE public.formations
  ADD COLUMN IF NOT EXISTS prix_ht NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(5,1) DEFAULT 0;

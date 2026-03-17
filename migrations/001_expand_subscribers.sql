-- ============================================================
-- Migration 001 — Expansão do cadastro de assinantes
-- Executar no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Novos campos no assinante (dados pessoais + endereço)
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS birth_date          date,
  ADD COLUMN IF NOT EXISTS address_zip         text,
  ADD COLUMN IF NOT EXISTS address_street      text,
  ADD COLUMN IF NOT EXISTS address_number      text,
  ADD COLUMN IF NOT EXISTS address_complement  text,
  ADD COLUMN IF NOT EXISTS address_neighborhood text,
  ADD COLUMN IF NOT EXISTS address_city        text,
  ADD COLUMN IF NOT EXISTS address_state       text,

-- 2. Condutor real — identificação e contato
  ADD COLUMN IF NOT EXISTS is_real_driver          boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS real_driver_name         text,
  ADD COLUMN IF NOT EXISTS real_driver_document     text,
  ADD COLUMN IF NOT EXISTS real_driver_phone        text,
  ADD COLUMN IF NOT EXISTS real_driver_relationship text,

-- 3. Condutor real — endereço completo
  ADD COLUMN IF NOT EXISTS real_driver_address_zip          text,
  ADD COLUMN IF NOT EXISTS real_driver_address_street       text,
  ADD COLUMN IF NOT EXISTS real_driver_address_number       text,
  ADD COLUMN IF NOT EXISTS real_driver_address_complement   text,
  ADD COLUMN IF NOT EXISTS real_driver_address_neighborhood text,
  ADD COLUMN IF NOT EXISTS real_driver_address_city         text,
  ADD COLUMN IF NOT EXISTS real_driver_address_state        text;

-- 4. Tabela de documentos vinculados ao assinante
CREATE TABLE IF NOT EXISTS subscriber_documents (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id uuid        NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  file_name     text        NOT NULL,
  file_url      text        NOT NULL,
  file_type     text        NOT NULL DEFAULT 'other', -- 'contract' | 'cnh' | 'photo' | 'other'
  description   text,
  created_at    timestamptz DEFAULT now()
);

-- 5. Índice para busca de documentos por assinante
CREATE INDEX IF NOT EXISTS idx_subscriber_documents_subscriber_id
  ON subscriber_documents(subscriber_id);

-- 6. Criar bucket subscriber-documents no Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('subscriber-documents', 'subscriber-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Políticas RLS do bucket subscriber-documents
CREATE POLICY "Authenticated users can upload subscriber documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'subscriber-documents');

CREATE POLICY "Authenticated users can read subscriber documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'subscriber-documents');

CREATE POLICY "Authenticated users can delete subscriber documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'subscriber-documents');

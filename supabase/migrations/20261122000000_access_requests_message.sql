-- Ajuste de access_requests al contrato de Nexo (POST /api/access-requests):
-- el formulario envía { name, email, organization, message? } y no pide rol.
--   - message: texto libre opcional, hasta 1000 caracteres.
--   - role: queda con valor por defecto 'other' (la columna sigue existiendo).
-- Igual que la tabla original: la escribe solo el servidor (service_role), RLS
-- activado y sin políticas, así que anon y authenticated no leen ni escriben.

alter table public.access_requests
  add column if not exists message text not null default ''
  check (char_length(message) <= 1000);

alter table public.access_requests
  alter column role set default 'other';

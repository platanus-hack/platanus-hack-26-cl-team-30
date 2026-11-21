-- Interviews answered by people who run a clinic, from the landing form.
-- Written and read only by the server (service_role). RLS on, no policies:
-- anon and authenticated keys can neither read nor write this table.
-- To publish one, set published_at in the dashboard after reviewing it.

create table if not exists public.clinic_interviews (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 120),
  role text not null check (char_length(role) between 2 and 120),
  clinic text not null check (char_length(clinic) between 2 and 160),
  email text not null default '' check (char_length(email) <= 254),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  consent_to_publish boolean not null,
  published_at timestamptz
);

create index if not exists clinic_interviews_published_idx
  on public.clinic_interviews (published_at desc)
  where published_at is not null;

alter table public.clinic_interviews enable row level security;

revoke all on table public.clinic_interviews from anon, authenticated;

comment on table public.clinic_interviews is
  'Landing interview answered by clinic leaders. Server-only (service_role). Publish by setting published_at.';

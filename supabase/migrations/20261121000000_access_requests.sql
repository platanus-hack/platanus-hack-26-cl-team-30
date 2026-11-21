-- Demo-access requests captured by the landing form.
-- Written only by the server (service_role). RLS is on with no policies,
-- so anon and authenticated keys can neither read nor write this table.

create table if not exists public.access_requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null unique check (char_length(email) <= 254 and email = lower(email)),
  organization text not null default '' check (char_length(organization) <= 160),
  role text not null check (role in ('clinical', 'management', 'committee', 'tech', 'other')),
  source text not null default 'landing'
);

alter table public.access_requests enable row level security;

revoke all on table public.access_requests from anon, authenticated;

comment on table public.access_requests is
  'Landing form: people asking for access to the live demo. Server-only (service_role).';

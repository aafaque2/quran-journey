-- "Report an issue" submissions (product spec §10). Run once in the Supabase SQL editor,
-- or with the Supabase CLI: `supabase db push`.
--
-- Reports can contain a reporter's contact details, so the table is locked down:
-- RLS is on and there are NO policies, which means the public (anon) key can neither read
-- nor write it. Only the server, using the service-role key, can (apps/web/lib/reports.ts).

create table if not exists public.reports (
  id uuid primary key,
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  part_number integer not null check (part_number > 0),
  section text check (char_length(section) <= 80),
  category text not null,
  message text not null check (char_length(message) between 5 and 2000),
  contact text check (char_length(contact) <= 200)
);

alter table public.reports enable row level security;

create index if not exists reports_created_at_idx on public.reports (created_at desc);

-- Family Events database setup.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then click Run.
-- It is safe to run more than once.
--
-- Who can see what:
--   * Only people on the family list (the "members" table) can see or change anything.
--   * The very first person to sign in becomes the admin automatically.
--   * Admins add or remove family members from the Family tab in the app.
--   * Everyone can only change their own RSVP.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table if not exists public.members (
  email      text primary key check (email = lower(email)),
  name       text not null check (char_length(name) between 1 and 60),
  color      text not null default '#e07a5f',
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  start_date  date not null,
  end_date    date,
  start_time  time,
  end_time    time,
  location    text check (char_length(location) <= 300),
  notes       text check (char_length(notes) <= 5000),
  created_by  text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  created_at  timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.rsvps (
  event_id   uuid not null references public.events(id) on delete cascade,
  on_date    date not null,  -- which date of the event (matters for repeating events)
  email      text not null references public.members(email) on delete cascade,
  status     text not null check (status in ('going', 'maybe', 'no')),
  note       text check (char_length(note) <= 300),
  updated_at timestamptz not null default now(),
  primary key (event_id, email, on_date)
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 300),
  event_id    uuid references public.events(id) on delete cascade,
  assigned_to text references public.members(email) on delete set null,
  due_date    date,
  done        boolean not null default false,
  created_by  text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  created_at  timestamptz not null default now()
);

-- ---------- Repeating events (added later; safe to run on an existing database) ----------

alter table public.events add column if not exists repeat text not null default 'none';
alter table public.events add column if not exists repeat_until date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'events_repeat_check') then
    alter table public.events add constraint events_repeat_check
      check (repeat in ('none', 'weekly', 'fortnightly', 'monthly', 'yearly'));
  end if;
end $$;

-- RSVPs are now per date, so people can say yes to one Sunday dinner and no to the next.
alter table public.rsvps add column if not exists on_date date;
update public.rsvps r set on_date = e.start_date from public.events e where r.event_id = e.id and r.on_date is null;
alter table public.rsvps alter column on_date set not null;
do $$ begin
  if (select array_length(conkey, 1) from pg_constraint where conname = 'rsvps_pkey') = 2 then
    alter table public.rsvps drop constraint rsvps_pkey;
    alter table public.rsvps add primary key (event_id, email, on_date);
  end if;
end $$;

-- ---------- Shareable tasks (added later; safe to run on an existing database) ----------
alter table public.tasks add column if not exists shared_with text[];

create index if not exists events_start_idx on public.events (start_date);
create index if not exists tasks_event_idx on public.tasks (event_id);

-- ---------- Helper functions ----------

create or replace function public.current_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where email = public.current_email())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where email = public.current_email() and is_admin)
$$;

-- The first person to sign in becomes the admin. Does nothing after that.
create or replace function public.claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.current_email() = '' then
    return false;
  end if;
  lock table public.members in exclusive mode;
  if exists (select 1 from public.members) then
    return false;
  end if;
  insert into public.members (email, name, is_admin)
  values (public.current_email(), initcap(split_part(public.current_email(), '@', 1)), true);
  return true;
end
$$;

revoke execute on function public.claim_admin() from public, anon;
grant execute on function public.claim_admin() to authenticated;

-- ---------- Table access ----------
-- New Supabase projects don't open tables to the app automatically.
-- Only signed-in people get access, and the row rules below still decide what each person sees.

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.members, public.events, public.rsvps, public.tasks to authenticated;
grant execute on function public.current_email(), public.is_member(), public.is_admin() to authenticated;

-- ---------- Row level security ----------

alter table public.members enable row level security;
alter table public.events  enable row level security;
alter table public.rsvps   enable row level security;
alter table public.tasks   enable row level security;

drop policy if exists members_select on public.members;
drop policy if exists members_insert on public.members;
drop policy if exists members_update on public.members;
drop policy if exists members_delete on public.members;
create policy members_select on public.members for select to authenticated using (public.is_member());
create policy members_insert on public.members for insert to authenticated with check (public.is_admin());
-- Admins can edit anyone; others can edit their own name/colour but can't make themselves admin.
create policy members_update on public.members for update to authenticated
  using (public.is_admin() or email = public.current_email())
  with check (public.is_admin() or (email = public.current_email() and is_admin = false));
-- Admins can remove others, but not themselves (so the family is never left without an admin).
create policy members_delete on public.members for delete to authenticated
  using (public.is_admin() and email <> public.current_email());

drop policy if exists events_all on public.events;
create policy events_all on public.events for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- Tasks can be for everyone (shared_with is null), private (empty list),
-- or shared with chosen people. The creator and the person doing it can always see it.
create or replace function public.can_see_task(t public.tasks) returns boolean
language sql stable as $$
  select public.is_member() and (
    t.shared_with is null
    or t.created_by = public.current_email()
    or t.assigned_to = public.current_email()
    or public.current_email() = any (t.shared_with)
  )
$$;
grant execute on function public.can_see_task(public.tasks) to authenticated;

drop policy if exists tasks_all on public.tasks;
drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;
create policy tasks_select on public.tasks for select to authenticated using (public.can_see_task(tasks));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_member() and created_by = public.current_email());
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_see_task(tasks)) with check (public.is_member());
create policy tasks_delete on public.tasks for delete to authenticated using (public.can_see_task(tasks));

-- Only the person who created a task can change who sees it.
create or replace function public.protect_task_sharing() returns trigger
language plpgsql as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'The creator of a task cannot be changed';
  end if;
  if new.shared_with is distinct from old.shared_with and old.created_by <> public.current_email() then
    raise exception 'Only the person who created this task can change who sees it';
  end if;
  return new;
end
$$;
drop trigger if exists tasks_protect_sharing on public.tasks;
create trigger tasks_protect_sharing before update on public.tasks
  for each row execute function public.protect_task_sharing();

drop policy if exists rsvps_select on public.rsvps;
drop policy if exists rsvps_write on public.rsvps;
create policy rsvps_select on public.rsvps for select to authenticated using (public.is_member());
create policy rsvps_write on public.rsvps for all to authenticated
  using (public.is_member() and email = public.current_email())
  with check (public.is_member() and email = public.current_email());

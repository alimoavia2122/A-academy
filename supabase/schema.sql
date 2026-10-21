-- =====================================================================
-- Arhum Academy Portal : database schema
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to read top to bottom. Run it once on a fresh project.
-- =====================================================================

-- Keeps updated_at current on every UPDATE
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------------
-- profiles: one row per portal user (linked to Supabase Auth) with a role
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('admin', 'accountant')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- settings: a single row (id = 1)
-- ---------------------------------------------------------------------
create table public.settings (
  id                     int primary key default 1 check (id = 1),
  academy_name           text not null default 'Arhum Academy, Dully Wala',
  address                text not null default 'Dully Wala',
  phone                  text not null default '',
  late_fine              numeric(10,2) not null default 100 check (late_fine >= 0),
  due_day                int not null default 10 check (due_day between 1 and 28),
  admission_fee_default  numeric(10,2) not null default 1000 check (admission_fee_default >= 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- classes and sections
-- ---------------------------------------------------------------------
create table public.classes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  monthly_fee  numeric(10,2) not null default 0 check (monthly_fee >= 0),
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.sections (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (class_id, name)
);
create index sections_class_idx on public.sections(class_id);

-- ---------------------------------------------------------------------
-- students (status 'left' = soft delete; rows are never removed)
-- ---------------------------------------------------------------------
create table public.students (
  id              uuid primary key default gen_random_uuid(),
  reg_no          text not null unique,                       -- e.g. ARH-2026-0001
  name            text not null,
  father_name     text not null,
  father_cnic     text,
  phone           text,
  whatsapp        text,
  address         text,
  class_id        uuid not null references public.classes(id) on delete restrict,
  section_id      uuid references public.sections(id) on delete restrict,
  admission_date  date not null default current_date,
  monthly_fee     numeric(10,2) not null check (monthly_fee >= 0),
  discount        numeric(10,2) not null default 0 check (discount >= 0),
  admission_fee   numeric(10,2) not null default 0 check (admission_fee >= 0),
  status          text not null default 'active' check (status in ('active', 'left')),
  left_date       date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (discount <= monthly_fee)
);
create index students_class_idx   on public.students(class_id);
create index students_section_idx on public.students(section_id);
create index students_status_idx  on public.students(status);
create index students_name_idx    on public.students(lower(name));

-- ---------------------------------------------------------------------
-- challans: one monthly challan per student per month (+ one admission challan)
--   total_payable = (tuition_fee - discount) + admission_fee + arrears (+ late_fine once applied)
--   carried_to    = set when this challan's unpaid balance moved into a newer challan
-- ---------------------------------------------------------------------
create table public.challans (
  id              uuid primary key default gen_random_uuid(),
  challan_no      text not null unique,                       -- e.g. CH-202610-0001
  student_id      uuid not null references public.students(id) on delete restrict,
  type            text not null default 'monthly' check (type in ('monthly', 'admission')),
  month           date not null check (extract(day from month) = 1),   -- first day of the month
  tuition_fee     numeric(10,2) not null default 0 check (tuition_fee >= 0),
  admission_fee   numeric(10,2) not null default 0 check (admission_fee >= 0),
  discount        numeric(10,2) not null default 0 check (discount >= 0),
  arrears         numeric(10,2) not null default 0 check (arrears >= 0),
  arrears_months  int not null default 0,
  late_fine       numeric(10,2) not null default 0 check (late_fine >= 0),  -- fine that applies after due date
  fine_applied    boolean not null default false,
  total_payable   numeric(10,2) not null check (total_payable >= 0),
  paid_amount     numeric(10,2) not null default 0 check (paid_amount >= 0),
  balance         numeric(10,2) generated always as (total_payable - paid_amount) stored,
  due_date        date not null,
  status          text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid')),
  carried_to      uuid references public.challans(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (paid_amount <= total_payable),
  constraint challans_student_month_type_key unique (student_id, month, type)   -- no duplicate challans
);
create index challans_student_idx on public.challans(student_id);
create index challans_month_idx   on public.challans(month);
create index challans_status_idx  on public.challans(status);
create index challans_open_idx    on public.challans(due_date) where carried_to is null and balance > 0;

-- ---------------------------------------------------------------------
-- payments (full or partial). A challan can have many payments.
-- ---------------------------------------------------------------------
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  receipt_no   text not null unique,                          -- e.g. RC-202610-0001
  challan_id   uuid not null references public.challans(id) on delete restrict,
  student_id   uuid not null references public.students(id) on delete restrict,
  amount       numeric(10,2) not null check (amount > 0),
  paid_on      date not null default current_date,
  method       text not null check (method in ('cash', 'bank', 'jazzcash', 'easypaisa')),
  received_by  text not null,
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index payments_challan_idx on public.payments(challan_id);
create index payments_student_idx on public.payments(student_id);
create index payments_paid_on_idx on public.payments(paid_on);

-- ---------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------
create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  expense_date  date not null default current_date,
  category      text not null check (category in ('rent', 'electricity', 'salaries', 'stationery', 'maintenance', 'other')),
  amount        numeric(10,2) not null check (amount > 0),
  description   text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index expenses_date_idx on public.expenses(expense_date);

-- Attach the updated_at trigger to every table
do $$
declare t text;
begin
  foreach t in array array['profiles','settings','classes','sections','students','challans','payments','expenses'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Dashboard totals in one call (used by GET /api/dashboard)
-- ---------------------------------------------------------------------
create or replace function public.dashboard_summary(p_month date) returns json
language sql stable as $$
  select json_build_object(
    'active_students', (select count(*) from public.students where status = 'active'),
    'billed',   coalesce((select sum(total_payable - arrears) from public.challans
                          where month = date_trunc('month', p_month)::date), 0),
    'collected', coalesce((select sum(amount) from public.payments
                          where paid_on >= date_trunc('month', p_month)::date
                            and paid_on <  (date_trunc('month', p_month) + interval '1 month')::date), 0),
    'pending',  coalesce((select sum(balance) from public.challans
                          where carried_to is null and balance > 0), 0),
    'expenses', coalesce((select sum(amount) from public.expenses
                          where expense_date >= date_trunc('month', p_month)::date
                            and expense_date <  (date_trunc('month', p_month) + interval '1 month')::date), 0)
  );
$$;
revoke execute on function public.dashboard_summary(date) from anon, authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- The Node server uses the SERVICE key, which bypasses RLS. These rules protect
-- the data if someone ever uses the public anon key directly: they can read
-- only if they are a portal user, and nobody can write without the server.
-- ---------------------------------------------------------------------
create or replace function public.current_portal_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_portal_role() = 'admin');

do $$
declare t text;
begin
  foreach t in array array['settings','classes','sections','students','challans','payments','expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "staff can read" on public.%I for select to authenticated using (public.current_portal_role() in (''admin'',''accountant''))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Seed data (edit freely)
-- ---------------------------------------------------------------------
insert into public.settings (id) values (1) on conflict do nothing;

insert into public.classes (name, monthly_fee, sort_order) values
  ('Play Group', 1200, 1), ('Nursery', 1300, 2), ('Prep', 1400, 3),
  ('Class 1', 1500, 4), ('Class 2', 1500, 5), ('Class 3', 1600, 6), ('Class 4', 1600, 7),
  ('Class 5', 1800, 8), ('Class 6', 2000, 9), ('Class 7', 2000, 10), ('Class 8', 2200, 11),
  ('Class 9', 2500, 12), ('Class 10', 2500, 13)
on conflict do nothing;

-- Section A for every class, Section B for the early classes
insert into public.sections (class_id, name) select id, 'A' from public.classes on conflict do nothing;
insert into public.sections (class_id, name)
  select id, 'B' from public.classes
  where name in ('Nursery', 'Prep', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5')
on conflict do nothing;

-- 10 demo students (delete them before going live)
insert into public.students
  (reg_no, name, father_name, father_cnic, phone, whatsapp, address, class_id, section_id, admission_date, monthly_fee, discount, admission_fee)
select v.reg, v.name, v.father, v.cnic, v.phone, v.phone, 'Dully Wala', c.id, s.id, v.adm::date, c.monthly_fee, v.disc, 1000
from (values
  ('ARH-2026-0001', 'Ayesha Khan',    'Imran Khan',      '33100-1234567-1', '0300-1111111', 'Class 1',   'A', '2026-01-05', 0),
  ('ARH-2026-0002', 'Hamza Ali',      'Ali Raza',        '33100-2345678-3', '0301-2222222', 'Class 1',   'B', '2026-01-06', 200),
  ('ARH-2026-0003', 'Fatima Noor',    'Noor Ahmad',      '33100-3456789-5', '0302-3333333', 'Class 2',   'A', '2026-01-10', 0),
  ('ARH-2026-0004', 'Usman Tariq',    'Tariq Mehmood',   '33100-4567890-7', '0303-4444444', 'Class 3',   'A', '2026-01-12', 0),
  ('ARH-2026-0005', 'Zainab Bibi',    'Abdul Rehman',    '33100-5678901-9', '0304-5555555', 'Class 4',   'A', '2026-01-15', 0),
  ('ARH-2026-0006', 'Bilal Ahmad',    'Ahmad Hussain',   '33100-6789012-2', '0305-6666666', 'Class 5',   'A', '2026-02-01', 300),
  ('ARH-2026-0007', 'Maryam Saleem',  'Saleem Akhtar',   '33100-7890123-4', '0306-7777777', 'Nursery',   'A', '2026-02-03', 0),
  ('ARH-2026-0008', 'Ibrahim Shahid', 'Shahid Iqbal',    '33100-8901234-6', '0307-8888888', 'Play Group','A', '2026-02-10', 0),
  ('ARH-2026-0009', 'Hira Javed',     'Javed Iqbal',     '33100-9012345-8', '0308-9999999', 'Class 6',   'A', '2026-03-01', 0),
  ('ARH-2026-0010', 'Ahmed Raza',     'Raza Hussain',    '33100-0123456-0', '0309-1010101', 'Class 8',   'A', '2026-03-05', 0)
) as v(reg, name, father, cnic, phone, cls, sec, adm, disc)
join public.classes  c on c.name = v.cls
join public.sections s on s.class_id = c.id and s.name = v.sec
on conflict do nothing;

-- ---------------------------------------------------------------------
-- FIRST ADMIN USER (pick ONE way)
--  A) Easiest: from your computer run
--       npm run create-admin -- "you@example.com" "StrongPassword123" "Your Name" admin
--  B) Manually: Supabase > Authentication > Users > Add user (tick "Auto confirm"),
--     copy the new user's UID, then run:
--       insert into public.profiles (id, full_name, role)
--       values ('PASTE-USER-UID-HERE', 'Your Name', 'admin');
--     (use role 'accountant' for accountant users)
-- ---------------------------------------------------------------------

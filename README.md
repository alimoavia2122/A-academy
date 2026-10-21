# Arhum Academy Portal (MVP)

A simple academy management portal for **Arhum Academy, Dully Wala**: students, monthly fee challans, fee collection, receipts, reports and expenses.

**Stack:** HTML + Tailwind CSS (CDN) + vanilla JavaScript on the front, Node.js + Express on the back, Supabase (PostgreSQL + Auth) for data and logins.

## 1. Prerequisites
- Node.js 18 or newer (`node -v`)
- A free Supabase account (https://supabase.com)
- Internet access in the browser (Tailwind and fonts load from a CDN)

## 2. Create the Supabase project and database
1. In Supabase click **New project**, choose a name, a strong database password and a region close to Pakistan (e.g. Singapore / Mumbai).
2. When it is ready open **SQL Editor > New query**.
3. Paste the full contents of `supabase/schema.sql` and click **Run**. This creates all tables, security rules, sample classes/sections and 10 demo students.

## 3. Set up `.env`
1. Copy `.env.example` to `.env`.
2. In Supabase open **Project Settings > API** and copy:
   - Project URL -> `SUPABASE_URL`
   - `anon` public key -> `SUPABASE_ANON_KEY`
   - `service_role` key -> `SUPABASE_SERVICE_KEY` (**secret**: only ever lives in `.env` on the server)
3. Set `PORT` (default 3000) and a long random `SESSION_SECRET`.

## 4. Install and run
```bash
npm install
npm start
```
Open http://localhost:3000

## 5. Create the first admin user
```bash
npm run create-admin -- "owner@example.com" "StrongPassword123" "Owner Name" admin
```
Create the accountant the same way, using `accountant` as the last word. (Manual alternative is at the bottom of `schema.sql`.)

## How login and security work
- Login uses **Supabase Auth** (email + password). The server signs the user in, and the browser keeps the returned token and sends it as `Authorization: Bearer <token>` on every request. The token is renewed automatically through `/api/auth/refresh`.
- `src/middleware/auth.js` verifies the token and loads the user's **role** from the `profiles` table. `src/middleware/roleCheck.js` then allows or blocks each route.
- The `service_role` key is used only by the Node server. The browser never sees it.
- All data queries go through the Supabase client (parameterised); search text is cleaned before use.
- Row Level Security is enabled on every table, so the public anon key cannot read or write anything on its own.

| Area | Admin | Accountant |
|---|---|---|
| Dashboard, reports | yes | yes |
| Classes, sections, settings | edit | no |
| Students | add / edit / mark left | view only |
| Challans, fee collection, receipts | yes | yes |
| Expenses | yes | yes |

## How fees work (read this once)
- **Monthly challan** = (class fee - discount) + arrears. One per student per month (the database rejects duplicates).
- **Arrears:** when a new challan is generated, any unpaid balance of earlier challans is added to it as *arrears*, and the older challan shows "Carried fwd". Fees are then collected on the newest challan. Generate months in order (September before October).
- **Late fine:** the fixed amount from *Classes & Settings* is printed as "payable after due date". It is added to the challan automatically the first time a payment is recorded after the due date.
- **Admission:** adding a student with an admission fee creates an *admission challan* (due in 7 days).
- Changing a class fee only affects **new** admissions. A student's own monthly fee can be edited on the student.
- Dashboard "billed" counts new charges only (arrears are not counted twice).
- Challans cannot be deleted in this MVP (to keep money records safe). Fix mistakes with a new payment or by editing the student before generating the next month.

## Project structure
```
server.js                 Express app, mounts all routes
supabase/schema.sql       Tables, RLS, seed data
scripts/create-admin.js   Creates a portal user
src/config/               Supabase client
src/middleware/           auth, roleCheck, errorHandler
src/routes/               URL -> controller mapping (one file per module)
src/controllers/          The business logic (one file per module)
src/utils/                Challan / receipt / roll number generators, helpers
public/*.html             Pages (one per module)
public/print/             Printable challan and receipt
public/js/                api.js + auth.js (shared) and one file per page
```
To add a module (e.g. payroll): add tables in a new SQL file, then `routes/payroll.js`, `controllers/payrollController.js`, mount it in `server.js`, add `public/payroll.html` + `public/js/payroll.js`, and add one line to `NAV` in `public/js/auth.js`.

## 6. Deploying (brief)
**Render / Railway (easiest)**
1. Push the project to GitHub (`.env` is git-ignored).
2. Create a new *Web Service* from the repo. Build command: `npm install`. Start command: `npm start`.
3. Add the environment variables from `.env` in the dashboard. The platform sets `PORT` for you.
4. Open the URL they give you and log in. Use HTTPS only.

**VPS (Ubuntu)**
1. Install Node 18+, clone the repo, run `npm install --omit=dev`, create `.env`.
2. Keep it running with `pm2 start server.js --name arhum-portal` and `pm2 save`.
3. Put Nginx in front as a reverse proxy to `localhost:3000` and add a free HTTPS certificate with Certbot.

## 7. Roadmap
- **Payroll:** teacher/staff salary sheets, linked to the Expenses "salaries" category
- **Profitability by class:** fees collected minus salary share per class
- **WhatsApp reminders:** defaulter messages with the challan link
- **Attendance:** daily student and teacher attendance, absentee alerts
- **Parent portal:** parents log in to see challans, receipts and attendance
- Also useful: online payments (JazzCash / Easypaisa), exam results, SMS, audit log

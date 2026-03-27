## Plan: Custom admin notification to employees via toast

### Overview

Admin writes a custom message in the Notifications tab, clicks send, then confirms sending, it gets stored in a new `admin_broadcasts` table. Employee Dashboard listens via Supabase Realtime for new inserts and displays each as a toast notification.

### Changes

#### 1. Database migration — new `admin_broadcasts` table

```sql
CREATE TABLE public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  sent_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

-- Admins can insert and view
CREATE POLICY "Admins can manage broadcasts" ON public.admin_broadcasts
  FOR ALL TO authenticated USING (is_admin_user(auth.uid()));

-- Employees can read (needed for realtime subscription)
CREATE POLICY "Employees can view broadcasts" ON public.admin_broadcasts
  FOR SELECT TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_broadcasts;
```

#### 2. `src/components/AdminDashboard.tsx` — Notifications tab

Add a third card "Custom obaveštenje" alongside existing menu alert and reminder cards:

- Textarea for message input
- Send button that inserts into `admin_broadcasts`
- Success toast on send

#### 3. `src/components/EmployeeDashboard.tsx` — Realtime listener

- Subscribe to `admin_broadcasts` INSERT events via Supabase Realtime
- On new broadcast, show a toast with the message text
- Only show broadcasts created after the component mounted (prevent old messages appearing on page load)

### Files to modify


| File                                   | Change                                               |
| -------------------------------------- | ---------------------------------------------------- |
| Migration SQL                          | Create `admin_broadcasts` table with RLS + realtime  |
| `src/components/AdminDashboard.tsx`    | Add custom notification card in Notifications tab    |
| `src/components/EmployeeDashboard.tsx` | Add Realtime subscription for broadcasts, show toast |

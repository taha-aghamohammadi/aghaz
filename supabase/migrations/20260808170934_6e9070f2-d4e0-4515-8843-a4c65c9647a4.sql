-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','staff')
  )
$$;

CREATE POLICY "own roles select" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins select all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. Admins can read all profiles
CREATE POLICY "staff select all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- 3. Desks
CREATE TABLE public.desks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  zone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'free',
  hourly_rate integer NOT NULL DEFAULT 0,
  daily_rate integer NOT NULL DEFAULT 0,
  monthly_rate integer NOT NULL DEFAULT 0,
  features text[] NOT NULL DEFAULT '{}',
  location_note text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.desks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.desks TO authenticated;
GRANT ALL ON public.desks TO service_role;
ALTER TABLE public.desks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desks public select" ON public.desks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "desks staff insert" ON public.desks FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "desks staff update" ON public.desks FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "desks staff delete" ON public.desks FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER desks_set_updated_at BEFORE UPDATE ON public.desks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Bookings
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  desk_id uuid REFERENCES public.desks(id) ON DELETE SET NULL,
  desk_code text NOT NULL DEFAULT '',
  booking_type text NOT NULL DEFAULT 'hourly',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  units integer NOT NULL DEFAULT 1,
  unit_price integer NOT NULL DEFAULT 0,
  total_amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmed',
  payment_status text NOT NULL DEFAULT 'unpaid',
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bookings_start_at_idx ON public.bookings (start_at DESC);
CREATE INDEX bookings_user_idx ON public.bookings (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own bookings select" ON public.bookings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own bookings insert" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff bookings select" ON public.bookings
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff bookings update" ON public.bookings
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff bookings delete" ON public.bookings
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff bookings insert" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Financial transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'income',
  category text NOT NULL DEFAULT '',
  amount integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  occurred_on date NOT NULL DEFAULT current_date,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX transactions_occurred_on_idx ON public.transactions (occurred_on DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff transactions select" ON public.transactions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff transactions insert" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff transactions update" ON public.transactions
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff transactions delete" ON public.transactions
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER transactions_set_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Seed 12 desks
INSERT INTO public.desks (code, name, zone, status, hourly_rate, daily_rate, monthly_rate, features, location_note) VALUES
('A1','میز A1','زون سکوت','free',45000,290000,4900000,'{"صندلی ارگونومیک","پریز برق","نور طبیعی"}','گوشه شمالی، کنار قفسه کتاب'),
('A2','میز A2','زون سکوت','free',45000,290000,4900000,'{"صندلی ارگونومیک","پریز برق"}','کنار پنجره شمالی'),
('A3','میز A3','زون سکوت','free',45000,290000,4900000,'{"صندلی ارگونومیک","چراغ مطالعه"}','ردیف دوم زون سکوت'),
('B1','میز B1','کنار پنجره','free',55000,340000,5400000,'{"نور طبیعی","پریز برق","مانیتور جانبی"}','ضلع غربی، نمای حیاط'),
('B2','میز B2','کنار پنجره','free',55000,340000,5400000,'{"نور طبیعی","پریز برق"}','ضلع غربی، میانه'),
('B3','میز B3','کنار پنجره','free',55000,340000,5400000,'{"نور طبیعی","پایه لپ‌تاپ"}','ضلع غربی، انتها'),
('C1','میز C1','فضای باز','free',40000,250000,4200000,'{"پریز برق"}','مرکز سالن'),
('C2','میز C2','فضای باز','free',40000,250000,4200000,'{"پریز برق","پایه لپ‌تاپ"}','مرکز سالن، ردیف دوم'),
('C3','میز C3','فضای باز','free',40000,250000,4200000,'{"پریز برق"}','نزدیک آبدارخانه'),
('C4','میز C4','فضای باز','free',40000,250000,4200000,'{"پریز برق","صندلی ارگونومیک"}','نزدیک پذیرش'),
('D1','میز D1','تراس','free',35000,220000,3800000,'{"هوای آزاد","پریز برق"}','تراس شرقی'),
('D2','میز D2','تراس','free',35000,220000,3800000,'{"هوای آزاد","سایبان"}','تراس شرقی، کنار گلدان‌ها');
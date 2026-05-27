-- RoyalePro Supabase security hardening
-- Safe to run multiple times (idempotent).

ALTER TABLE IF EXISTS public.analysis_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.battle_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.online_calibration ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.analysis_events FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON TABLE public.battle_feedback FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON TABLE public.online_calibration FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON TABLE public.ml_feedback_daily FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON TABLE public.ml_deck_outcomes FROM %I', role_name);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analysis_events TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.battle_feedback TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.online_calibration TO service_role;
    GRANT SELECT ON TABLE public.ml_feedback_daily TO service_role;
    GRANT SELECT ON TABLE public.ml_deck_outcomes TO service_role;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'analysis_events'
        AND policyname = 'service_role_all_analysis_events'
    ) THEN
      CREATE POLICY service_role_all_analysis_events
      ON public.analysis_events
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'battle_feedback'
        AND policyname = 'service_role_all_battle_feedback'
    ) THEN
      CREATE POLICY service_role_all_battle_feedback
      ON public.battle_feedback
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'online_calibration'
        AND policyname = 'service_role_all_online_calibration'
    ) THEN
      CREATE POLICY service_role_all_online_calibration
      ON public.online_calibration
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF current_setting('server_version_num')::INT >= 150000 THEN
    EXECUTE 'ALTER VIEW public.ml_feedback_daily SET (security_invoker = true)';
    EXECUTE 'ALTER VIEW public.ml_deck_outcomes SET (security_invoker = true)';
  END IF;
END
$$;

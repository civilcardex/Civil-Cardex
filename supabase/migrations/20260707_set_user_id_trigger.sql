-- Set user_id from auth.uid() on INSERT to plano_trazos
-- This eliminates the need for the client to send user_id in the payload.
-- RLS policy WITH CHECK (auth.uid() = user_id) still protects the row.

CREATE OR REPLACE FUNCTION public.set_plano_trazos_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_plano_trazos_user_id ON public.plano_trazos;

CREATE TRIGGER trg_set_plano_trazos_user_id
  BEFORE INSERT ON public.plano_trazos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_plano_trazos_user_id();

-- Pin search_path on SECURITY DEFINER function to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.create_certification_from_formation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
  v_months INT;
  v_end_date DATE;
BEGIN
  IF NEW.status <> 'valide' OR NEW.resultat <> 'obtenu' THEN
    RETURN NEW;
  END IF;

  SELECT
    CASE f.type
      WHEN 'SST'     THEN 'sst'
      WHEN 'MAC_APS' THEN 'mac_aps'
      WHEN 'SSIAP1'  THEN 'ssiap1'
      WHEN 'SSIAP2'  THEN 'ssiap2'
      WHEN 'SSIAP3'  THEN 'ssiap3'
      WHEN 'APS'     THEN 'tfp_aps'
      WHEN 'H0B0'    THEN 'h0b0'
      ELSE NULL
    END,
    CASE f.type
      WHEN 'SST'     THEN 24
      WHEN 'MAC_APS' THEN 60
      WHEN 'SSIAP1'  THEN 36
      WHEN 'SSIAP2'  THEN 36
      WHEN 'SSIAP3'  THEN 36
      WHEN 'APS'     THEN 60
      WHEN 'H0B0'    THEN 36
      ELSE NULL
    END,
    f.end_date
  INTO v_type, v_months, v_end_date
  FROM formations f
  WHERE f.id = NEW.formation_id;

  IF v_type IS NULL OR v_end_date IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO certifications (
    stagiaire_id,
    type,
    date_obtention,
    date_expiration,
    source,
    formation_id
  ) VALUES (
    NEW.stagiaire_id,
    v_type,
    v_end_date,
    v_end_date + (v_months || ' months')::INTERVAL,
    'auto',
    NEW.formation_id
  )
  ON CONFLICT (stagiaire_id, type) DO UPDATE SET
    date_obtention = EXCLUDED.date_obtention,
    date_expiration = EXCLUDED.date_expiration,
    formation_id = EXCLUDED.formation_id,
    source = 'auto',
    updated_at = now();

  RETURN NEW;
END;
$$;

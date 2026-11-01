-- =============================================================================
-- Test Script: google_maps_url_test.sql
-- Description: Unit test for public.properties google_maps_url CHECK constraint:
--   - Valid maps.app.goo.gl accepted
--   - Valid google.com/maps accepted
--   - http:// rejected
--   - evil.com rejected
--   - google.com.evil.com rejected
--   - >500 chars rejected
--   - NULL accepted
-- Execution: Runs inside BEGIN ... ROLLBACK so no test artifacts persist.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_prop_id uuid;
  v_error_caught boolean;
  v_long_url text;
  v_retrieved_url text;
BEGIN
  -- 0. Set service_role claim to bypass RLS in test environment
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Starting properties.google_maps_url CHECK Constraint Test';
  RAISE NOTICE '=======================================================';


  -- Use an existing property (everything is rolled back at the end)
  SELECT id INTO v_prop_id FROM public.properties LIMIT 1;
  IF v_prop_id IS NULL THEN
    RAISE EXCEPTION 'No property found to test against';
  END IF;
  -- ---------------------------------------------------------------------------
  -- TEST 1: Valid maps.app.goo.gl link accepted
  -- ---------------------------------------------------------------------------
  UPDATE public.properties
  SET google_maps_url = 'https://maps.app.goo.gl/AbCdEfGh12345'
  WHERE id = v_prop_id;

  SELECT google_maps_url INTO v_retrieved_url FROM public.properties WHERE id = v_prop_id;
  IF v_retrieved_url <> 'https://maps.app.goo.gl/AbCdEfGh12345' THEN
    RAISE EXCEPTION 'TEST 1 FAILED: maps.app.goo.gl link was not saved correctly.';
  END IF;
  RAISE NOTICE 'PASS: TEST 1 - Valid maps.app.goo.gl link accepted.';

  -- ---------------------------------------------------------------------------
  -- TEST 2: Valid google.com/maps link accepted
  -- ---------------------------------------------------------------------------
  UPDATE public.properties
  SET google_maps_url = 'https://www.google.com/maps/place/Bretania+Islands/@8.6872,126.2415,15z'
  WHERE id = v_prop_id;

  SELECT google_maps_url INTO v_retrieved_url FROM public.properties WHERE id = v_prop_id;
  IF v_retrieved_url <> 'https://www.google.com/maps/place/Bretania+Islands/@8.6872,126.2415,15z' THEN
    RAISE EXCEPTION 'TEST 2 FAILED: google.com/maps link was not saved correctly.';
  END IF;
  RAISE NOTICE 'PASS: TEST 2 - Valid google.com/maps link accepted.';

  -- ---------------------------------------------------------------------------
  -- TEST 3: Insecure http:// link rejected
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    UPDATE public.properties
    SET google_maps_url = 'http://maps.app.goo.gl/InsecureLink'
    WHERE id = v_prop_id;
  EXCEPTION WHEN check_violation THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 3 FAILED: http:// link was NOT rejected by constraint.';
  END IF;
  RAISE NOTICE 'PASS: TEST 3 - http:// link correctly rejected.';

  -- ---------------------------------------------------------------------------
  -- TEST 4: Phishing / evil.com domain rejected
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    UPDATE public.properties
    SET google_maps_url = 'https://evil.com/maps/fake-location'
    WHERE id = v_prop_id;
  EXCEPTION WHEN check_violation THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 4 FAILED: evil.com domain was NOT rejected by constraint.';
  END IF;
  RAISE NOTICE 'PASS: TEST 4 - evil.com correctly rejected.';

  -- ---------------------------------------------------------------------------
  -- TEST 5: Subdomain bypass (google.com.evil.com) rejected
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  BEGIN
    UPDATE public.properties
    SET google_maps_url = 'https://google.com.evil.com/maps'
    WHERE id = v_prop_id;
  EXCEPTION WHEN check_violation THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 5 FAILED: google.com.evil.com domain was NOT rejected by constraint.';
  END IF;
  RAISE NOTICE 'PASS: TEST 5 - google.com.evil.com correctly rejected.';

  -- ---------------------------------------------------------------------------
  -- TEST 6: URL exceeding 500 characters rejected
  -- ---------------------------------------------------------------------------
  v_error_caught := false;
  v_long_url := 'https://maps.app.goo.gl/' || repeat('x', 485); -- length is 24 + 485 = 509 chars (> 500)
  BEGIN
    UPDATE public.properties
    SET google_maps_url = v_long_url
    WHERE id = v_prop_id;
  EXCEPTION WHEN check_violation THEN
    v_error_caught := true;
  END;

  IF NOT v_error_caught THEN
    RAISE EXCEPTION 'TEST 6 FAILED: URL exceeding 500 characters was NOT rejected.';
  END IF;
  RAISE NOTICE 'PASS: TEST 6 - >500 character URL correctly rejected.';

  -- ---------------------------------------------------------------------------
  -- TEST 7: NULL value accepted (optional field)
  -- ---------------------------------------------------------------------------
  UPDATE public.properties
  SET google_maps_url = NULL
  WHERE id = v_prop_id;

  SELECT google_maps_url INTO v_retrieved_url FROM public.properties WHERE id = v_prop_id;
  IF v_retrieved_url IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 7 FAILED: NULL value was not stored as NULL.';
  END IF;
  RAISE NOTICE 'PASS: TEST 7 - NULL accepted.';

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'All 7 properties.google_maps_url CHECK tests passed!';
  RAISE NOTICE '=======================================================';
END $$;

ROLLBACK;

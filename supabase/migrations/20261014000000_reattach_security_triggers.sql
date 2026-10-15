BEGIN;

-- =============================================================================
-- Migration: 20261014000000_reattach_security_triggers.sql
-- Description: Reattach database security triggers for signup, profiles, bookings, and messages
-- Idempotent, safe execution. Does NOT redefine prevent_booking_financial_tampering.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Signup Trigger: Prevent self-role assignment via client metadata
-- -----------------------------------------------------------------------------
-- Public signups must ALWAYS default to 'tourist' with auto-approval (is_approved = true).
-- Host and admin accounts are provisioned exclusively by approved administrators
-- via secure server actions using service_role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    phone_number,
    is_approved
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'tourist'::user_role, -- Enforced default: ignores client-supplied role
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    true                  -- Tourists are auto-approved
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Idempotently re-bind trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 2. Profiles: Prevent unauthorized role or approval escalation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_profile_role_tampering()
RETURNS trigger AS $$
DECLARE
  v_caller_role user_role;
  v_caller_approved boolean;
  v_jwt_role text;
BEGIN
  -- Check if privileged fields are being modified
  IF (OLD.role IS DISTINCT FROM NEW.role) OR (OLD.is_approved IS DISTINCT FROM NEW.is_approved) THEN
    
    -- Allow Service Role key (used in secure server actions)
    v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), (auth.jwt() ->> 'role'));
    IF v_jwt_role = 'service_role' THEN
      RETURN NEW;
    END IF;

    -- Verify if caller is an approved admin in profiles
    SELECT role, is_approved INTO v_caller_role, v_caller_approved
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_role = 'admin' AND v_caller_approved = true THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Access Denied: You do not have permission to modify account roles or approval status.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_tampering ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_tampering
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_tampering();


-- -----------------------------------------------------------------------------
-- 3. Bookings: Attach trigger to existing prevent_booking_financial_tampering
-- -----------------------------------------------------------------------------
-- Note: Function public.prevent_booking_financial_tampering() was updated with
-- all cancellation and refund fields in 20261012000000_cancellation_phase1_schema.sql.
-- Here we attach the BEFORE UPDATE trigger.
DROP TRIGGER IF EXISTS trg_prevent_booking_financial_tampering ON public.bookings;
CREATE TRIGGER trg_prevent_booking_financial_tampering
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_financial_tampering();


-- -----------------------------------------------------------------------------
-- 4. Messages: Prevent message tampering (only if public.messages exists)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.prevent_message_tampering()
      RETURNS trigger AS $body$
      DECLARE
        v_jwt_role text;
      BEGIN
        v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), (auth.jwt() ->> 'role'));
        IF v_jwt_role = 'service_role' THEN
          RETURN NEW;
        END IF;

        -- Message content, sender, receiver, and timestamp can NEVER be altered once sent
        IF NEW.content IS DISTINCT FROM OLD.content OR
           NEW.sender_id IS DISTINCT FROM OLD.sender_id OR
           NEW.receiver_id IS DISTINCT FROM OLD.receiver_id OR
           NEW.created_at IS DISTINCT FROM OLD.created_at THEN
          RAISE EXCEPTION 'Access Denied: Message history is immutable.';
        END IF;

        -- Only receiver can update is_read
        IF NEW.is_read IS DISTINCT FROM OLD.is_read AND auth.uid() != OLD.receiver_id THEN
          RAISE EXCEPTION 'Access Denied: Only the recipient can mark a message as read.';
        END IF;

        RETURN NEW;
      END;
      $body$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
    $func$;

    DROP TRIGGER IF EXISTS trg_prevent_message_tampering ON public.messages;
    CREATE TRIGGER trg_prevent_message_tampering
      BEFORE UPDATE ON public.messages
      FOR EACH ROW EXECUTE FUNCTION public.prevent_message_tampering();

    RAISE NOTICE 'Attached trg_prevent_message_tampering to public.messages.';
  ELSE
    RAISE NOTICE 'Skipping messages trigger: public.messages table does not exist.';
  END IF;
END $$;

COMMIT;

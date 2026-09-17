-- ============================================================
-- Supabase Keep-Alive & Heartbeat Table Setup
-- Prevents Supabase project from auto-pausing due to inactivity (7-day free tier limit)
-- ============================================================

CREATE TABLE IF NOT EXISTS _keep_alive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ping_source TEXT NOT NULL DEFAULT 'cron',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE _keep_alive ENABLE ROW LEVEL SECURITY;

-- Allow insert and delete for anon & authenticated roles or service_role
CREATE POLICY "Allow public insert for heartbeat"
  ON _keep_alive FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public select for heartbeat"
  ON _keep_alive FOR SELECT
  USING (true);

CREATE POLICY "Allow public delete for heartbeat"
  ON _keep_alive FOR DELETE
  USING (true);

-- Function to ping and automatically clean up old records
CREATE OR REPLACE FUNCTION ping_and_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_id UUID;
  v_deleted_count INT;
BEGIN
  -- 1. Insert new ping record
  INSERT INTO _keep_alive (ping_source, metadata)
  VALUES ('database_rpc', jsonb_build_object('timestamp', now()))
  RETURNING id INTO v_inserted_id;

  -- 2. Delete all records older than 1 minute (or delete immediately)
  -- This ensures the table stays empty and does not consume storage space
  WITH deleted AS (
    DELETE FROM _keep_alive
    WHERE id = v_inserted_id OR created_at < now() - interval '1 minute'
    RETURNING *
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Heartbeat recorded and cleaned up successfully',
    'deleted_records', v_deleted_count,
    'timestamp', now()
  );
END;
$$;

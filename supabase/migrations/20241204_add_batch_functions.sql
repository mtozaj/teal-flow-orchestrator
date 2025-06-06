
-- Function to increment batch success count
CREATE OR REPLACE FUNCTION increment_batch_success(batch_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE batches 
  SET success_count = success_count + 1,
      processed_eids = processed_eids + 1,
      updated_at = now()
  WHERE id = batch_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment batch failure count
CREATE OR REPLACE FUNCTION increment_batch_failure(batch_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE batches 
  SET failure_count = failure_count + 1,
      processed_eids = processed_eids + 1,
      updated_at = now()
  WHERE id = batch_id;
END;
$$ LANGUAGE plpgsql;

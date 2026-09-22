-- 1. Add caching columns to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;

-- 2. Create the function that recalculates the rating and updates the property
CREATE OR REPLACE FUNCTION public.update_property_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_property_id UUID;
  v_avg_rating NUMERIC(3,2);
  v_reviews_count INTEGER;
BEGIN
  -- Determine which property we are updating
  IF TG_OP = 'DELETE' THEN
    v_property_id := OLD.property_id;
  ELSE
    v_property_id := NEW.property_id;
  END IF;

  -- Calculate the new average rating and count
  -- Only count published reviews if you have a status, otherwise count all
  SELECT 
    COALESCE(AVG(rating), 0)::NUMERIC(3,2),
    COUNT(*)
  INTO 
    v_avg_rating,
    v_reviews_count
  FROM public.reviews
  WHERE property_id = v_property_id AND status = 'published';

  -- Update the parent properties table
  UPDATE public.properties
  SET 
    rating = v_avg_rating,
    reviews_count = v_reviews_count
  WHERE id = v_property_id;

  RETURN NULL; -- AFTER trigger so return value is ignored
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger to execute on INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trigger_update_property_rating ON public.reviews;
CREATE TRIGGER trigger_update_property_rating
AFTER INSERT OR UPDATE OF rating, status OR DELETE
ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_property_rating();

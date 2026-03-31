-- Enable PostGIS extension for geo queries
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- Function: get_carriers_near_location
-- Returns carrier_users within a given radius in miles from a lat/lng point.
-- Uses the Haversine formula since PostGIS may use geography type.
CREATE OR REPLACE FUNCTION get_carriers_near_location(
  lat double precision,
  lng double precision,
  radius_miles double precision DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  company_name text,
  mc_number text,
  dot_number text,
  is_verified boolean,
  is_active boolean,
  current_lat double precision,
  current_lng double precision,
  distance_miles double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    cu.id,
    cu.name,
    cu.email,
    cu.phone,
    cu.company_name,
    cu.mc_number,
    cu.dot_number,
    cu.is_verified,
    cu.is_active,
    cu.current_lat,
    cu.current_lng,
    -- Haversine distance in miles
    3958.8 * 2 * ASIN(
      SQRT(
        POWER(SIN((RADIANS(cu.current_lat) - RADIANS(lat)) / 2), 2)
        + COS(RADIANS(lat)) * COS(RADIANS(cu.current_lat))
        * POWER(SIN((RADIANS(cu.current_lng) - RADIANS(lng)) / 2), 2)
      )
    ) AS distance_miles
  FROM carrier_users cu
  WHERE
    cu.current_lat IS NOT NULL
    AND cu.current_lng IS NOT NULL
    AND cu.is_active = true
    AND 3958.8 * 2 * ASIN(
      SQRT(
        POWER(SIN((RADIANS(cu.current_lat) - RADIANS(lat)) / 2), 2)
        + COS(RADIANS(lat)) * COS(RADIANS(cu.current_lat))
        * POWER(SIN((RADIANS(cu.current_lng) - RADIANS(lng)) / 2), 2)
      )
    ) <= radius_miles
  ORDER BY distance_miles ASC;
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION get_carriers_near_location(double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION get_carriers_near_location(double precision, double precision, double precision) TO service_role;

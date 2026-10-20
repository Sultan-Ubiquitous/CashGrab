-- Truck diesel cost and distance become aggregates of the truck's trips,
-- computed live by the "truck_financials" view below (mirrors the
-- "trip_financials" pattern). The manually-entered readings are dropped.

ALTER TABLE "truck" DROP CONSTRAINT "truck_non_negative_chk";

ALTER TABLE "truck"
  DROP COLUMN "diesel_cost",
  DROP COLUMN "diesel_liters",
  DROP COLUMN "distance_traveled";

-- ---------------------------------------------------------------------------
-- truck_financials: the single SQL definition of every derived truck figure.
--   diesel_cost       = SUM(trip_cost.diesel) of the truck's trips
--   distance_traveled = SUM(trip.distance) of the truck's trips
--   trip_count        = COUNT(*) of the truck's trips
-- ---------------------------------------------------------------------------
CREATE VIEW "truck_financials" AS
SELECT
  tr."id"                                      AS "truck_id",
  tr."user_id",
  COALESCE(s."diesel_cost", 0)                 AS "diesel_cost",
  COALESCE(s."distance_traveled", 0)           AS "distance_traveled",
  COALESCE(s."trip_count", 0)                  AS "trip_count"
FROM "truck" tr
LEFT JOIN LATERAL (
  SELECT
    SUM(c."diesel")   AS "diesel_cost",
    SUM(t."distance") AS "distance_traveled",
    COUNT(*)::bigint  AS "trip_count"
  FROM "trip" t
  JOIN "trip_cost" c ON c."id" = t."trip_cost_id" AND c."user_id" = t."user_id"
  WHERE t."truck_id" = tr."id" AND t."user_id" = tr."user_id"
) s ON TRUE;

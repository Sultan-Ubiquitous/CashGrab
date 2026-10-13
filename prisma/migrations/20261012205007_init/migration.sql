-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT,
    "display_username" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(3),
    "refresh_token_expires_at" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "truck" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "registration_number" TEXT NOT NULL,
    "diesel_cost" DECIMAL(14,2) NOT NULL,
    "diesel_liters" DECIMAL(12,2) NOT NULL,
    "distance_traveled" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bella" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cost_price" DECIMAL(12,2) NOT NULL,
    "selling_price" DECIMAL(12,2) NOT NULL,
    "source_ownership" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bella_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_cost" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "diesel" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adblue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "royalty" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "toll_taxes" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "driver_salary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "miscellaneous" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "labour" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trip_cost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "bella_id" TEXT NOT NULL,
    "trip_cost_id" TEXT NOT NULL,
    "truck_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "trip_date" DATE NOT NULL,
    "distance" DECIMAL(12,2) NOT NULL,
    "start_point" TEXT NOT NULL,
    "end_point" TEXT NOT NULL,
    "brick_quantity" INTEGER NOT NULL,
    "brick_cost_price" DECIMAL(12,2) NOT NULL,
    "brick_selling_price" DECIMAL(12,2) NOT NULL,
    "brick_source_ownership" BOOLEAN NOT NULL,
    "include_brick_cost" BOOLEAN NOT NULL DEFAULT true,
    "net_margin_calculated" DECIMAL(14,2) NOT NULL,
    "net_margin_override" DECIMAL(14,2),
    "payment_due" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paid_on" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "truck_user_id_created_at_idx" ON "truck"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "truck_id_user_id_key" ON "truck"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "truck_user_id_registration_number_key" ON "truck"("user_id", "registration_number");

-- CreateIndex
CREATE INDEX "driver_user_id_created_at_idx" ON "driver"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "driver_id_user_id_key" ON "driver"("id", "user_id");

-- CreateIndex
CREATE INDEX "customer_user_id_created_at_idx" ON "customer"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_id_user_id_key" ON "customer"("id", "user_id");

-- CreateIndex
CREATE INDEX "bella_user_id_created_at_idx" ON "bella"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bella_id_user_id_key" ON "bella"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_cost_id_user_id_key" ON "trip_cost"("id", "user_id");

-- CreateIndex
CREATE INDEX "trip_user_id_trip_date_idx" ON "trip"("user_id", "trip_date");

-- CreateIndex
CREATE INDEX "trip_user_id_payment_due_idx" ON "trip"("user_id", "payment_due");

-- CreateIndex
CREATE INDEX "trip_user_id_customer_id_idx" ON "trip"("user_id", "customer_id");

-- CreateIndex
CREATE INDEX "trip_user_id_truck_id_idx" ON "trip"("user_id", "truck_id");

-- CreateIndex
CREATE INDEX "trip_user_id_driver_id_idx" ON "trip"("user_id", "driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_id_user_id_key" ON "trip"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_bella_id_user_id_key" ON "trip"("bella_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_trip_cost_id_user_id_key" ON "trip"("trip_cost_id", "user_id");

-- CreateIndex
CREATE INDEX "payment_trip_id_idx" ON "payment"("trip_id");

-- CreateIndex
CREATE INDEX "payment_user_id_paid_on_idx" ON "payment"("user_id", "paid_on");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck" ADD CONSTRAINT "truck_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver" ADD CONSTRAINT "driver_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bella" ADD CONSTRAINT "bella_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_cost" ADD CONSTRAINT "trip_cost_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_customer_id_user_id_fkey" FOREIGN KEY ("customer_id", "user_id") REFERENCES "customer"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_bella_id_user_id_fkey" FOREIGN KEY ("bella_id", "user_id") REFERENCES "bella"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_trip_cost_id_user_id_fkey" FOREIGN KEY ("trip_cost_id", "user_id") REFERENCES "trip_cost"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_truck_id_user_id_fkey" FOREIGN KEY ("truck_id", "user_id") REFERENCES "truck"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_driver_id_user_id_fkey" FOREIGN KEY ("driver_id", "user_id") REFERENCES "driver"("id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_trip_id_user_id_fkey" FOREIGN KEY ("trip_id", "user_id") REFERENCES "trip"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity rules not expressible in the Prisma schema
-- ---------------------------------------------------------------------------
ALTER TABLE "truck" ADD CONSTRAINT "truck_non_negative_chk"
  CHECK ("diesel_cost" >= 0 AND "diesel_liters" >= 0 AND "distance_traveled" >= 0);

ALTER TABLE "bella" ADD CONSTRAINT "bella_non_negative_chk"
  CHECK ("quantity" >= 0 AND "cost_price" >= 0 AND "selling_price" >= 0);

ALTER TABLE "trip_cost" ADD CONSTRAINT "trip_cost_non_negative_chk"
  CHECK ("diesel" >= 0 AND "adblue" >= 0 AND "royalty" >= 0 AND "toll_taxes" >= 0
     AND "driver_salary" >= 0 AND "miscellaneous" >= 0 AND "labour" >= 0);

ALTER TABLE "trip" ADD CONSTRAINT "trip_non_negative_chk"
  CHECK ("distance" >= 0 AND "brick_quantity" >= 0 AND "brick_cost_price" >= 0 AND "brick_selling_price" >= 0);

-- Brick cost may only be skipped for own-kiln bricks.
ALTER TABLE "trip" ADD CONSTRAINT "trip_skip_brick_cost_only_own_kiln_chk"
  CHECK ("include_brick_cost" OR "brick_source_ownership");

ALTER TABLE "payment" ADD CONSTRAINT "payment_amount_positive_chk" CHECK ("amount" > 0);

-- ---------------------------------------------------------------------------
-- trip_financials: the single SQL definition of every derived trip figure.
-- Mirrors src/server/services/calc.ts (tests assert they agree).
--   revenue            = brick_quantity * brick_selling_price
--   brick_cost         = include_brick_cost ? brick_quantity * brick_cost_price : 0
--   total_trip_cost    = sum of the 7 trip_cost categories
--   net_margin_effective = COALESCE(override, calculated)
--   amount_received    = SUM(payment.amount)
--   amount_remaining   = revenue - amount_received
-- ---------------------------------------------------------------------------
CREATE VIEW "trip_financials" AS
SELECT
  t."id"                    AS "trip_id",
  t."user_id",
  t."trip_date",
  t."customer_id",
  t."truck_id",
  t."driver_id",
  t."payment_due",
  (t."brick_quantity" * t."brick_selling_price")                                        AS "revenue",
  (CASE WHEN t."include_brick_cost" THEN t."brick_quantity" * t."brick_cost_price" ELSE 0 END) AS "brick_cost",
  (c."diesel" + c."adblue" + c."royalty" + c."toll_taxes" + c."driver_salary" + c."miscellaneous" + c."labour") AS "total_trip_cost",
  t."net_margin_calculated",
  t."net_margin_override",
  COALESCE(t."net_margin_override", t."net_margin_calculated")                          AS "net_margin_effective",
  COALESCE(p."amount_received", 0)                                                      AS "amount_received",
  (t."brick_quantity" * t."brick_selling_price") - COALESCE(p."amount_received", 0)     AS "amount_remaining"
FROM "trip" t
JOIN "trip_cost" c ON c."id" = t."trip_cost_id" AND c."user_id" = t."user_id"
LEFT JOIN LATERAL (
  SELECT SUM(pa."amount") AS "amount_received" FROM "payment" pa WHERE pa."trip_id" = t."id"
) p ON TRUE;

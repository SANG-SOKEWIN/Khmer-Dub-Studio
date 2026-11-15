CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestCount" INTEGER NOT NULL DEFAULT 0 CHECK ("requestCount" >= 0)
);
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

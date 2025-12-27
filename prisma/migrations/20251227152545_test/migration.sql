-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('MANUFACTURER', 'IMPORTER', 'RESPONSIBLE_PERSON', 'AUTHORIZED_REP', 'DISTRIBUTOR', 'FULFILLMENT_PROVIDER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('COMMUNITY', 'PRIMARY_SOURCE', 'OFFICIAL_REGISTRY', 'PRODUCT_LABEL', 'WEBSITE', 'API_IMPORT', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "VerificationStatusType" AS ENUM ('UNVERIFIED', 'COMMUNITY_CONFIRMED', 'PRIMARY_CONFIRMED', 'HISTORICAL', 'DISPUTED', 'OUTDATED');

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "normalizedAddress" TEXT,
    "normalizedCity" TEXT,
    "normalizedCountry" TEXT NOT NULL,
    "normalizedVatId" TEXT,
    "normalizedEmail" TEXT,
    "normalizedPhone" TEXT,
    "normalizedWebsite" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityRole" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "roleType" "RoleType" NOT NULL,
    "marketContext" TEXT,
    "productScope" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceIdentifier" TEXT,
    "description" TEXT,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "trustNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityVersion" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "originalData" JSONB NOT NULL,
    "normalizedData" JSONB NOT NULL,
    "versionNumber" SERIAL NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "changeNote" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRecord" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "VerificationStatusType" NOT NULL,
    "verifiedBy" TEXT,
    "verificationMethod" TEXT,
    "notes" TEXT,
    "evidenceUrl" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "VerificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "performedBy" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Entity_normalizedName_idx" ON "Entity"("normalizedName");

-- CreateIndex
CREATE INDEX "Entity_normalizedCountry_idx" ON "Entity"("normalizedCountry");

-- CreateIndex
CREATE INDEX "Entity_normalizedVatId_idx" ON "Entity"("normalizedVatId");

-- CreateIndex
CREATE INDEX "Entity_isActive_idx" ON "Entity"("isActive");

-- CreateIndex
CREATE INDEX "EntityRole_entityId_idx" ON "EntityRole"("entityId");

-- CreateIndex
CREATE INDEX "EntityRole_roleType_idx" ON "EntityRole"("roleType");

-- CreateIndex
CREATE INDEX "EntityRole_marketContext_idx" ON "EntityRole"("marketContext");

-- CreateIndex
CREATE INDEX "EntityRole_isActive_idx" ON "EntityRole"("isActive");

-- CreateIndex
CREATE INDEX "Source_sourceType_idx" ON "Source"("sourceType");

-- CreateIndex
CREATE INDEX "EntityVersion_entityId_idx" ON "EntityVersion"("entityId");

-- CreateIndex
CREATE INDEX "EntityVersion_sourceId_idx" ON "EntityVersion"("sourceId");

-- CreateIndex
CREATE INDEX "EntityVersion_isCurrent_idx" ON "EntityVersion"("isCurrent");

-- CreateIndex
CREATE INDEX "EntityVersion_capturedAt_idx" ON "EntityVersion"("capturedAt");

-- CreateIndex
CREATE INDEX "VerificationRecord_versionId_idx" ON "VerificationRecord"("versionId");

-- CreateIndex
CREATE INDEX "VerificationRecord_status_idx" ON "VerificationRecord"("status");

-- CreateIndex
CREATE INDEX "VerificationRecord_verifiedAt_idx" ON "VerificationRecord"("verifiedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_performedBy_idx" ON "AuditLog"("performedBy");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "EntityRole" ADD CONSTRAINT "EntityRole_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityVersion" ADD CONSTRAINT "EntityVersion_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityVersion" ADD CONSTRAINT "EntityVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRecord" ADD CONSTRAINT "VerificationRecord_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "EntityVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

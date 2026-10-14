-- CreateTable
CREATE TABLE "Admin2FASetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "encryptedSecret" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "isEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "recoveryCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin2FASetting_pkey" PRIMARY KEY ("id")
);

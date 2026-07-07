-- CreateTable
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chunk_attachmentId_idx" ON "Chunk"("attachmentId");

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

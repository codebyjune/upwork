-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "parseError" TEXT,
ADD COLUMN     "parseStatus" TEXT,
ADD COLUMN     "parsedMarkdown" TEXT,
ADD COLUMN     "parsedText" TEXT;

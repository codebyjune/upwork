import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".json": "application/json",
  ".csv": "text/csv",
  ".zip": "application/zip",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (name.includes("..") || name.includes("/")) {
    return NextResponse.json({ error: "非法路径" }, { status: 400 });
  }
  const filePath = path.join(UPLOAD_DIR, name);
  const data = await readFile(filePath).catch(() => null);
  if (!data) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }
  const ext = path.extname(name).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  return new NextResponse(data, {
    headers: {
      "Content-Type": type,
      "Content-Length": data.length.toString(),
      "Cache-Control": "private, max-age=31536000",
    },
  });
}

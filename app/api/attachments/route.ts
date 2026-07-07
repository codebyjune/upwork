import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_SIZE = 10 * 1024 * 1024;

async function ensureDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export async function GET() {
  const list = await prisma.attachment.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "请使用 multipart/form-data 上传" },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "文件超过 10 MB 限制" },
      { status: 413 }
    );
  }

  await ensureDir();
  const ext = path.extname(file.name);
  const storedName = `${randomUUID()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const url = `/api/uploads/${storedName}`;
  const record = await prisma.attachment.create({
    data: {
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      url,
    },
  });
  return NextResponse.json(record, { status: 201 });
}

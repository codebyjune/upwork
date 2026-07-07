import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.DASHSCOPE_API_KEY) {
    return NextResponse.json(
      { error: "未配置 DASHSCOPE_API_KEY 环境变量" },
      { status: 500 }
    );
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "附件不存在" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const query = body?.query;
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "缺少 query 参数" }, { status: 400 });
  }

  const limit = Math.min(Math.max(1, Number(body?.limit) || 5), 20);

  const openai = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });

  const embedResp = await openai.embeddings.create({
    model: "text-embedding-v4",
    input: query,
    dimensions: 1024,
  });
  const queryVector = `[${embedResp.data[0].embedding.join(",")}]`;

  const results = await prisma.$queryRawUnsafe<
    Array<{ id: string; index: number; content: string; similarity: number }>
  >(
    `SELECT id, index, content, 1 - (embedding <=> $1::vector) AS similarity
     FROM "Chunk"
     WHERE "attachmentId" = $2
     ORDER BY similarity DESC
     LIMIT $3`,
    queryVector,
    id,
    limit
  );

  return NextResponse.json({ results });
}

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  if (!process.env.DASHSCOPE_API_KEY) {
    return NextResponse.json(
      { error: "未配置 DASHSCOPE_API_KEY 环境变量" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const query = body?.query;
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "缺少 query 参数" }, { status: 400 });
  }
  const limit = Math.min(Math.max(1, Number(body?.limit) || 5), 20);
  const threshold = Math.min(Math.max(0, Number(body?.threshold) || 0.35), 1);

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
    Array<{
      id: string;
      index: number;
      content: string;
      similarity: number;
      attachmentId: string;
      attachmentName: string;
    }>
  >(
    `SELECT c.id, c.index, c.content, c."attachmentId",
            1 - (c.embedding <=> $1::vector) AS similarity,
            a.name AS "attachmentName"
     FROM "Chunk" c
     JOIN "Attachment" a ON a.id = c."attachmentId"
     WHERE a."parseStatus" = 'completed'
       AND 1 - (c.embedding <=> $1::vector) > $3
     ORDER BY similarity DESC
     LIMIT $2`,
    queryVector,
    limit,
    threshold
  );

  return NextResponse.json({ results });
}

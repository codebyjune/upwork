import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  const { query } = await req.json();
  if (!query || !process.env.DASHSCOPE_API_KEY) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }

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

  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; content: string; similarity: number; attachmentId: string }>
  >(
    `SELECT c.id, c.content, 1 - (c.embedding <=> $1::vector) AS similarity, c."attachmentId"
     FROM "Chunk" c
     ORDER BY similarity DESC
     LIMIT 3`,
    queryVector
  );

  const total = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int as count FROM "Chunk"`
  );

  return NextResponse.json({ totalChunks: total[0].count, results: rows });
}

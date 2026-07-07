import path from "node:path";
import { readFile, unlink } from "node:fs/promises";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import LlamaCloud from "@llamaindex/llama-cloud";
import { MarkdownTextSplitter } from "@langchain/textsplitters";
import OpenAI from "openai";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const EMBEDDING_BATCH = 10;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await prisma.attachment.findUnique({ where: { id } });
  if (!record) {
    return NextResponse.json({ error: "附件不存在" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await prisma.attachment.findUnique({ where: { id } });
  if (!record) {
    return NextResponse.json({ error: "附件不存在" }, { status: 404 });
  }

  const fileName = record.url.split("/").pop();
  if (fileName) {
    await unlink(path.join(UPLOAD_DIR, fileName)).catch(() => {});
  }

  await prisma.attachment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.LLAMA_CLOUD_API_KEY) {
    return NextResponse.json(
      { error: "未配置 LLAMA_CLOUD_API_KEY 环境变量" },
      { status: 500 }
    );
  }

  const { id } = await params;
  const record = await prisma.attachment.findUnique({ where: { id } });
  if (!record) {
    return NextResponse.json({ error: "附件不存在" }, { status: 404 });
  }

  if (record.type !== "application/pdf") {
    return NextResponse.json({ error: "仅支持解析 PDF 文件" }, { status: 400 });
  }

  if (record.parseStatus === "running") {
    return NextResponse.json({ error: "文件正在解析中" }, { status: 409 });
  }

  await prisma.attachment.update({
    where: { id },
    data: { parseStatus: "running", parseError: null },
  });

  try {
    const fileName = record.url.split("/").pop();
    if (!fileName) throw new Error("文件名解析失败");

    const filePath = path.join(UPLOAD_DIR, fileName);
    const buffer = await readFile(filePath);
    const uploadable = new File([buffer], record.name, { type: "application/pdf" });

    const client = new LlamaCloud();

    const result = await client.parsing.parse(
      {
        tier: "cost_effective",
        version: "latest",
        upload_file: uploadable,
        expand: ["text", "markdown"],
      },
      { verbose: false }
    );

    const textPages = result.text?.pages?.map((p) => p.text) ?? [];
    const markdownPages =
      result.markdown?.pages
        ?.filter(
          (p): p is { success: true; markdown: string; page_number: number } =>
            p.success === true
        )
        .map((p) => p.markdown) ?? [];

    const text = textPages.join("\n\n");
    const markdown = markdownPages.join("\n\n");

    const splitter = new MarkdownTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await splitter.createDocuments([markdown]);
    const chunkTexts = chunks.map((c) => c.pageContent);

    if (process.env.DASHSCOPE_API_KEY && chunkTexts.length > 0) {
      const openai = new OpenAI({
        apiKey: process.env.DASHSCOPE_API_KEY,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      });

      const embeddings: number[][] = [];
      for (let i = 0; i < chunkTexts.length; i += EMBEDDING_BATCH) {
        const batch = chunkTexts.slice(i, i + EMBEDDING_BATCH);
        const resp = await openai.embeddings.create({
          model: "text-embedding-v4",
          input: batch,
          dimensions: 1024,
        });
        resp.data.forEach((d) => embeddings.push(d.embedding));
      }

      await prisma.$executeRawUnsafe(
        `DELETE FROM "Chunk" WHERE "attachmentId" = $1`,
        id
      );

      for (let i = 0; i < chunkTexts.length; i++) {
        const emb = `[${embeddings[i].join(",")}]`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Chunk" ("id", "attachmentId", "index", "content", "embedding", "createdAt")
           VALUES ($1, $2, $3, $4, $5::vector, $6)`,
          crypto.randomUUID(),
          id,
          i,
          chunkTexts[i],
          emb,
          new Date()
        );
      }
    }

    const updated = await prisma.attachment.update({
      where: { id },
      data: {
        parseStatus: "completed",
        parsedText: text,
        parsedMarkdown: markdown,
        chunks: chunkTexts,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "解析失败");
    console.error("PDF 解析错误:", message, error);
    try {
      await prisma.attachment.update({
        where: { id },
        data: { parseStatus: "failed", parseError: message },
      });
    } catch {
      // 忽略数据库更新错误，确保响应能正常返回
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { streamText, convertToModelMessages } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import OpenAI from "openai";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const userMsg = [...messages]
    .reverse()
    .find((m: { role: string }) => m.role === "user");
  const query =
    typeof userMsg?.content === "string"
      ? userMsg.content
      : userMsg?.parts?.map((p: { text?: string }) => p.text).join("") ?? "";

  let context = "";
  let hasRelevantContext = false;
  const SIMILARITY_THRESHOLD = 0.35;

  if (query && process.env.DASHSCOPE_API_KEY) {
    try {
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
        Array<{ content: string; similarity: number }>
      >(
        `SELECT content, 1 - (embedding <=> $1::vector) AS similarity
         FROM "Chunk"
         WHERE 1 - (embedding <=> $1::vector) > $2
         ORDER BY embedding <=> $1::vector
         LIMIT 5`,
        queryVector,
        SIMILARITY_THRESHOLD
      );

      if (rows.length > 0) {
        context = rows.map((r) => r.content).join("\n\n---\n\n");
        hasRelevantContext = true;
      }
    } catch (err) {
      console.error("[RAG] search error:", err);
    }
  }

  const modelMessages = await convertToModelMessages(messages);

  const systemPrompt = hasRelevantContext
    ? `基于以下文档内容回答用户问题。如果文档中找不到答案，如实说明，不要编造。\n\n文档内容：\n${context}`
    : `未检索到与用户问题相关的文档内容。请如实说明无法回答，不要编造答案，可以建议用户上传相关文档或换一种问法。`;

  modelMessages.unshift({
    role: "system",
    content: systemPrompt,
  } as { role: "system"; content: string });

  console.log(
    "[RAG] query:",
    query,
    "hasContext:",
    hasRelevantContext,
    "msgs:",
    modelMessages.length
  );

  const result = streamText({
    model: deepseek("deepseek-chat"),
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}

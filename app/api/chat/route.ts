import { streamText, convertToModelMessages } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: deepseek("deepseek-chat"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}

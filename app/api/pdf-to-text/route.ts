import LlamaCloud from "@llamaindex/llama-cloud";
import { NextResponse } from "next/server";

const MAX_SIZE = 10 * 1024 * 1024;
const TIERS = ["fast", "cost_effective", "agentic", "agentic_plus"] as const;

export async function POST(req: Request) {
  if (!process.env.LLAMA_CLOUD_API_KEY) {
    return NextResponse.json(
      { error: "未配置 LLAMA_CLOUD_API_KEY 环境变量" },
      { status: 500 }
    );
  }

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

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "只支持 PDF 文件" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "文件超过 10 MB 限制" },
      { status: 413 }
    );
  }

  const tier = (form.get("tier") as string) || "cost_effective";
  if (typeof tier === "string" && !TIERS.includes(tier as never)) {
    return NextResponse.json(
      { error: `无效的 tier，可选值: ${TIERS.join(", ")}` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadable = new File([buffer], file.name, { type: "application/pdf" });

  const client = new LlamaCloud();

  try {
    const result = await client.parsing.parse(
      {
        tier: tier as "fast" | "cost_effective" | "agentic" | "agentic_plus",
        version: "latest",
        upload_file: uploadable,
        expand: ["text", "markdown"],
      },
      { verbose: false }
    );

    const textPages = result.text?.pages?.map((p) => p.text) ?? [];
    const markdownPages =
      result.markdown?.pages
        ?.filter((p): p is { success: true; markdown: string; page_number: number } => p.success === true)
        .map((p) => p.markdown) ?? [];

    return NextResponse.json({
      text: textPages.join("\n\n"),
      markdown: markdownPages.join("\n\n"),
      text_pages: textPages,
      markdown_pages: markdownPages,
      job_id: result.job?.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

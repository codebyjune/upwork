import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "../../../generated/prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const conv = await prisma.conversation.findUnique({
    where: { id },
  });
  if (!conv) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(conv);
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  await prisma.conversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await req.json()) as {
    messages?: unknown;
    title?: string;
  };

  const data: Prisma.ConversationUpdateInput = {};
  if (body.messages !== undefined) {
    data.messages = body.messages as Prisma.InputJsonValue;
    const messages = body.messages as Array<{
      role: string;
      parts: Array<{ type: string; text: string }>;
    }>;
    const firstUser = messages.find((m) => m.role === "user");
    const text = firstUser?.parts.find((p) => p.type === "text")?.text;
    data.title = (text ?? "新对话").slice(0, 20);
  }
  if (body.title !== undefined) {
    data.title = body.title;
  }

  const conv = await prisma.conversation.update({
    where: { id },
    data,
  });
  return NextResponse.json(conv);
}
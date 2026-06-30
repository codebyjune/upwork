import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const list = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  const conv = await prisma.conversation.create({
    data: { title: title ?? "新对话", messages: [] },
  });
  return NextResponse.json(conv);
}

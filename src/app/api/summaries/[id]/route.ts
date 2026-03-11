import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const summary = await prisma.summary.findUnique({
    where: { id },
    include: {
      upload: {
        select: {
          id: true,
          filename: true,
          userId: true,
          patient: { select: { name: true, ownerName: true } },
        },
      },
    },
  });

  if (!summary || summary.upload.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ summary });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const summary = await prisma.summary.findUnique({
    where: { id },
    include: { upload: { select: { userId: true } } },
  });

  if (!summary || summary.upload.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.summary.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

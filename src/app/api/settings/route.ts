import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    prompt: settings?.prompt ||
      "You are a veterinary cardiologist. Summarize the following discharge notes, highlighting key cardiac findings, medications, and follow-up recommendations.",
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { prompt } = await req.json();

  const settings = await prisma.settings.upsert({
    where: { userId: user.id },
    update: { prompt },
    create: { prompt, userId: user.id },
  });

  return NextResponse.json({ prompt: settings.prompt });
}

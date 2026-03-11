import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const summaries = await prisma.summary.findMany({
    where: { upload: { userId: user.id } },
    include: {
      upload: {
        select: {
          filename: true,
          createdAt: true,
          patient: { select: { name: true, ownerName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ summaries });
}

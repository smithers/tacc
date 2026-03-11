import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const upload = await prisma.upload.findUnique({
    where: { id },
    select: { fileData: true, filename: true, mimeType: true, userId: true },
  });

  if (!upload || upload.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(upload.fileData), {
    headers: {
      "Content-Type": upload.mimeType,
      "Content-Disposition": `inline; filename="${upload.filename}"`,
    },
  });
}

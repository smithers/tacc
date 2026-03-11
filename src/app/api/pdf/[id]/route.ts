import { NextRequest, NextResponse } from "next/server";
import ReactPDF from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SummaryDocument } from "@/components/summary-pdf";

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

  const pdfStream = await ReactPDF.renderToStream(
    SummaryDocument({
      patientName: summary.upload.patient.name,
      ownerName: summary.upload.patient.ownerName,
      filename: summary.upload.filename,
      content: summary.content,
      date: summary.createdAt.toISOString(),
    })
  );

  const chunks: Buffer[] = [];
  for await (const chunk of pdfStream) {
    chunks.push(Buffer.from(chunk));
  }
  const pdfBuffer = Buffer.concat(chunks);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="summary-${id}.pdf"`,
    },
  });
}

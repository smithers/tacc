import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const patientName = formData.get("patientName") as string | null;

  if (!file || !patientName) {
    return NextResponse.json({ error: "File and patient name are required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Create patient and upload in a transaction
  const upload = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: { name: patientName, species: "", breed: null, ownerName: "" },
    });

    return tx.upload.create({
      data: {
        filename: file.name,
        fileData: buffer,
        mimeType: file.type || "application/pdf",
        patientId: patient.id,
        userId: user.id,
      },
    });
  });

  return NextResponse.json({ upload: { id: upload.id, filename: upload.filename } });
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  const patientName = formData.get("patientName") as string | null;

  if (files.length === 0 || !patientName) {
    return NextResponse.json({ error: "At least one file and patient name are required" }, { status: 400 });
  }

  const uploads = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: { name: patientName, species: "", breed: null, ownerName: "" },
    });

    const created = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const upload = await tx.upload.create({
        data: {
          filename: file.name,
          fileData: buffer,
          mimeType: file.type || "application/pdf",
          patientId: patient.id,
          userId: user.id,
        },
      });
      created.push(upload);
    }
    return created;
  });

  return NextResponse.json({ uploadIds: uploads.map((u) => u.id) });
}

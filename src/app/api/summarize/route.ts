import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { extractText } from "unpdf";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const openai = new OpenAI();

const DEFAULT_PROMPT =
  "You are a veterinary cardiologist. Summarize the following discharge notes, highlighting key cardiac findings, medications, and follow-up recommendations.";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { uploadId, notes } = await req.json();

  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: { summary: true },
  });

  if (!upload) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  if (upload.summary) {
    return NextResponse.json({ summary: upload.summary, status: "complete" });
  }

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const systemPrompt = settings?.prompt || DEFAULT_PROMPT;

  try {
    const pdfBuffer = Buffer.from(upload.fileData);
    const pdfUint8 = new Uint8Array(pdfBuffer);
    const { text: pdfPages } = await extractText(pdfUint8);
    const pdfText = pdfPages.join("\n").trim();

    const notesText = notes
      ? `\n\nAdditional rDVM notes/comments:\n\n${notes}`
      : "";

    let content: string;

    if (pdfText && pdfText.length > 50) {
      // Text-based PDF — send extracted text
      content = `Please summarize these discharge notes.${notesText}\n\n--- Discharge Notes ---\n${pdfText}`;
    } else {
      // Scanned PDF — send as base64 image-based content
      const pdfBase64 = pdfBuffer.toString("base64");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  filename: upload.filename,
                  file_data: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: `Please summarize these discharge notes.${notesText}`,
              },
            ],
          },
        ],
      });

      const summaryText = completion.choices[0]?.message?.content || "";
      const summary = await prisma.summary.create({
        data: { content: summaryText, uploadId: upload.id },
      });
      return NextResponse.json({ summary, status: "complete" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
    });

    const summaryText = completion.choices[0]?.message?.content || "";

    const summary = await prisma.summary.create({
      data: { content: summaryText, uploadId: upload.id },
    });

    return NextResponse.json({ summary, status: "complete" });
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    return NextResponse.json(
      { error: error.message || "Failed to process PDF" },
      { status: error.status || 500 }
    );
  }
}

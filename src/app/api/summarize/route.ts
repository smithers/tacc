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

  const body = await req.json();

  // Support both single uploadId (legacy) and multiple uploadIds
  const uploadIds: string[] = body.uploadIds || (body.uploadId ? [body.uploadId] : []);
  const notes: string = body.notes || "";

  if (uploadIds.length === 0) {
    return NextResponse.json({ error: "No upload IDs provided" }, { status: 400 });
  }

  const uploads = await prisma.upload.findMany({
    where: { id: { in: uploadIds } },
    include: { summary: true },
  });

  if (uploads.length === 0) {
    return NextResponse.json({ error: "Uploads not found" }, { status: 404 });
  }

  // If first upload already has a summary, return it
  const firstUpload = uploads.find((u) => u.id === uploadIds[0]) || uploads[0];
  if (firstUpload.summary) {
    return NextResponse.json({ summary: firstUpload.summary, status: "complete" });
  }

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const basePrompt = settings?.prompt || DEFAULT_PROMPT;
  const systemPrompt = notes
    ? `${basePrompt}\n\nThe user has provided the following additional instructions. If these conflict with the above instructions, prioritize these:\n${notes}`
    : basePrompt;

  try {
    const allTextParts: string[] = [];
    const scannedPdfs: { filename: string; base64: string }[] = [];

    for (const upload of uploads) {
      const pdfBuffer = Buffer.from(upload.fileData);
      const pdfUint8 = new Uint8Array(pdfBuffer);
      const { text: pdfPages } = await extractText(pdfUint8);
      const pdfText = pdfPages.join("\n").trim();

      if (pdfText && pdfText.length > 50) {
        allTextParts.push(`--- ${upload.filename} ---\n${pdfText}`);
      } else {
        scannedPdfs.push({
          filename: upload.filename,
          base64: pdfBuffer.toString("base64"),
        });
      }
    }

    const notesText = notes
      ? `\n\nAdditional rDVM notes/comments:\n\n${notes}`
      : "";

    let summaryText: string;

    if (scannedPdfs.length > 0 && allTextParts.length === 0) {
      // All scanned PDFs — send as file content
      const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = scannedPdfs.map((pdf) => ({
        type: "file" as const,
        file: {
          filename: pdf.filename,
          file_data: `data:application/pdf;base64,${pdf.base64}`,
        },
      }));
      content.push({
        type: "text",
        text: `Please summarize these discharge notes.${notesText}`,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
      });
      summaryText = completion.choices[0]?.message?.content || "";
    } else {
      // Text-based PDFs (possibly mixed with scanned — include scanned as files too)
      const combinedText = allTextParts.join("\n\n");
      const textContent = `Please summarize these discharge notes.${notesText}\n\n${combinedText}`;

      if (scannedPdfs.length > 0) {
        const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
          { type: "text", text: textContent },
          ...scannedPdfs.map((pdf) => ({
            type: "file" as const,
            file: {
              filename: pdf.filename,
              file_data: `data:application/pdf;base64,${pdf.base64}`,
            },
          })),
        ];
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 4096,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content },
          ],
        });
        summaryText = completion.choices[0]?.message?.content || "";
      } else {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 4096,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: textContent },
          ],
        });
        summaryText = completion.choices[0]?.message?.content || "";
      }
    }

    // Link summary to the first upload
    const summary = await prisma.summary.create({
      data: { content: summaryText, uploadId: firstUpload.id },
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

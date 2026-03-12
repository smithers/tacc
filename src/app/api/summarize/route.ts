import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import pdfParse from "pdf-parse";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const anthropic = new Anthropic({ maxRetries: 3 });

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

  if (upload.summary?.status === "complete") {
    return NextResponse.json({ summary: upload.summary, status: "complete" });
  }

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const systemPrompt = settings?.prompt || DEFAULT_PROMPT;

  try {
    // Extract text from PDF
    const pdfBuffer = Buffer.from(upload.fileData);
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;

    if (!pdfText.trim()) {
      return NextResponse.json({ error: "Could not extract text from PDF. The file may be scanned/image-based." }, { status: 400 });
    }

    const userText = notes
      ? `Please summarize these discharge notes. Additional rDVM notes/comments:\n\n${notes}\n\n--- Discharge Notes ---\n${pdfText}`
      : `Please summarize these discharge notes.\n\n--- Discharge Notes ---\n${pdfText}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }],
    });

    const block = message.content[0];
    const summaryText = block.type === "text" ? block.text : "";

    const summary = await prisma.summary.create({
      data: {
        content: summaryText,
        uploadId: upload.id,
      },
    });

    return NextResponse.json({ summary, status: "complete" });
  } catch (err: unknown) {
    const apiError = err as { status?: number; error?: { error?: { message?: string } } };
    const msg = apiError.error?.error?.message || "Failed to process PDF";
    return NextResponse.json({ error: msg }, { status: apiError.status || 500 });
  }
}

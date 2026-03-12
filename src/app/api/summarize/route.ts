import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const anthropic = new Anthropic();

const DEFAULT_PROMPT =
  "You are a veterinary cardiologist. Summarize the following discharge notes, highlighting key cardiac findings, medications, and follow-up recommendations.";

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
    return NextResponse.json({ summary: upload.summary });
  }

  // Get user's custom prompt or use default
  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const systemPrompt = settings?.prompt || DEFAULT_PROMPT;

  const pdfBase64 = Buffer.from(upload.fileData).toString("base64");

  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: notes
                ? `Please summarize these discharge notes. Additional rDVM notes/comments:\n\n${notes}`
                : "Please summarize these discharge notes.",
            },
          ],
        },
      ],
    });
  } catch (err: unknown) {
    const apiError = err as { status?: number; error?: { error?: { message?: string } } };
    const msg = apiError.error?.error?.message || "Failed to process PDF";
    return NextResponse.json({ error: msg }, { status: apiError.status || 500 });
  }

  const contentBlock = message.content[0];
  const summaryText = contentBlock.type === "text" ? contentBlock.text : "";

  const summary = await prisma.summary.create({
    data: {
      content: summaryText,
      uploadId: upload.id,
    },
  });

  return NextResponse.json({ summary });
}

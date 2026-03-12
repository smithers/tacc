import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const anthropic = new Anthropic();

const MAX_PAGES_PER_CHUNK = 100;

const DEFAULT_PROMPT =
  "You are a veterinary cardiologist. Summarize the following discharge notes, highlighting key cardiac findings, medications, and follow-up recommendations.";

async function splitPdfIntoChunks(pdfBuffer: Buffer): Promise<Buffer[]> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const totalPages = pdf.getPageCount();

  if (totalPages <= MAX_PAGES_PER_CHUNK) {
    return [pdfBuffer];
  }

  const chunks: Buffer[] = [];
  for (let start = 0; start < totalPages; start += MAX_PAGES_PER_CHUNK) {
    const end = Math.min(start + MAX_PAGES_PER_CHUNK, totalPages);
    const chunkPdf = await PDFDocument.create();
    const pages = await chunkPdf.copyPages(pdf, Array.from({ length: end - start }, (_, i) => start + i));
    pages.forEach((page) => chunkPdf.addPage(page));
    chunks.push(Buffer.from(await chunkPdf.save()));
  }

  return chunks;
}

async function summarizeChunk(
  pdfBase64: string,
  systemPrompt: string,
  chunkLabel: string,
  notes?: string
): Promise<string> {
  const userText = notes
    ? `${chunkLabel}\n\nPlease summarize these discharge notes. Additional rDVM notes/comments:\n\n${notes}`
    : `${chunkLabel}\n\nPlease summarize these discharge notes.`;

  const message = await anthropic.messages.create({
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
            text: userText,
          },
        ],
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

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

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const systemPrompt = settings?.prompt || DEFAULT_PROMPT;

  const pdfBuffer = Buffer.from(upload.fileData);

  try {
    const chunks = await splitPdfIntoChunks(pdfBuffer);
    let summaryText: string;

    if (chunks.length === 1) {
      // Single chunk — summarize directly
      const pdfBase64 = chunks[0].toString("base64");
      summaryText = await summarizeChunk(pdfBase64, systemPrompt, "", notes);
    } else {
      // Multiple chunks — summarize each, then combine
      const chunkSummaries: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const pdfBase64 = chunks[i].toString("base64");
        const label = `[Part ${i + 1} of ${chunks.length}]`;
        const chunkSummary = await summarizeChunk(pdfBase64, systemPrompt, label, i === 0 ? notes : undefined);
        chunkSummaries.push(chunkSummary);
      }

      // Final consolidation call
      const combinedMessage = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `The following are summaries from different sections of the same patient's discharge notes. Please combine them into one cohesive summary, removing any redundancy:\n\n${chunkSummaries.map((s, i) => `--- Part ${i + 1} ---\n${s}`).join("\n\n")}`,
          },
        ],
      });

      const block = combinedMessage.content[0];
      summaryText = block.type === "text" ? block.text : "";
    }

    const summary = await prisma.summary.create({
      data: {
        content: summaryText,
        uploadId: upload.id,
      },
    });

    return NextResponse.json({ summary });
  } catch (err: unknown) {
    const apiError = err as { status?: number; error?: { error?: { message?: string } } };
    const msg = apiError.error?.error?.message || "Failed to process PDF";
    return NextResponse.json({ error: msg }, { status: apiError.status || 500 });
  }
}

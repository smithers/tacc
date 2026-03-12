import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const anthropic = new Anthropic({ maxRetries: 3 });

const MAX_PAGES_PER_CHUNK = 25;

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

  // If already complete, return it
  if (upload.summary?.status === "complete") {
    return NextResponse.json({ summary: upload.summary, status: "complete" });
  }

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const systemPrompt = settings?.prompt || DEFAULT_PROMPT;
  const pdfBuffer = Buffer.from(upload.fileData);
  const chunks = await splitPdfIntoChunks(pdfBuffer);

  // Single chunk — process in one shot with Sonnet
  if (chunks.length === 1) {
    const pdfBase64 = chunks[0].toString("base64");
    const userText = notes
      ? `Please summarize these discharge notes. Additional rDVM notes/comments:\n\n${notes}`
      : "Please summarize these discharge notes.";

    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: "user", content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: userText },
          ]},
        ],
      });
      const block = message.content[0];
      const summaryText = block.type === "text" ? block.text : "";

      const summary = await prisma.summary.create({
        data: { content: summaryText, status: "complete", totalChunks: 1, chunksComplete: 1, uploadId: upload.id },
      });
      return NextResponse.json({ summary, status: "complete" });
    } catch (err: unknown) {
      const apiError = err as { status?: number; error?: { error?: { message?: string } } };
      const msg = apiError.error?.error?.message || "Failed to process PDF";
      return NextResponse.json({ error: msg }, { status: apiError.status || 500 });
    }
  }

  // Multi-chunk — process one chunk per request
  let summaryRecord = upload.summary;

  // Create the summary record if it doesn't exist
  if (!summaryRecord) {
    summaryRecord = await prisma.summary.create({
      data: {
        content: "",
        status: "processing",
        totalChunks: chunks.length,
        chunksComplete: 0,
        chunkSummaries: "[]",
        uploadId: upload.id,
      },
    });
  }

  // Consolidation step — all chunks done, combine summaries
  if (summaryRecord.status === "consolidating") {
    const partialSummaries: string[] = JSON.parse(summaryRecord.chunkSummaries || "[]");
    try {
      const combinedMessage = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `The following are summaries from different sections of the same patient's discharge notes. Please combine them into one cohesive summary, removing any redundancy:\n\n${partialSummaries.map((s, i) => `--- Part ${i + 1} ---\n${s}`).join("\n\n")}`,
          },
        ],
      });
      const finalBlock = combinedMessage.content[0];
      const finalText = finalBlock.type === "text" ? finalBlock.text : "";

      summaryRecord = await prisma.summary.update({
        where: { id: summaryRecord.id },
        data: { content: finalText, status: "complete" },
      });
      return NextResponse.json({ summary: summaryRecord, status: "complete" });
    } catch (err: unknown) {
      const apiError = err as { status?: number; error?: { error?: { message?: string } } };
      const msg = apiError.error?.error?.message || "Failed to consolidate summary";
      return NextResponse.json({ error: msg }, { status: apiError.status || 500 });
    }
  }

  // If still processing, do the next chunk
  if (summaryRecord.status === "processing") {
    const chunkIndex = summaryRecord.chunksComplete;
    const partialSummaries: string[] = JSON.parse(summaryRecord.chunkSummaries || "[]");

    if (chunkIndex < chunks.length) {
      // Summarize next chunk
      const pdfBase64 = chunks[chunkIndex].toString("base64");
      const label = `[Part ${chunkIndex + 1} of ${chunks.length}]`;
      const userText = (chunkIndex === 0 && notes)
        ? `${label}\n\nPlease summarize these discharge notes. Additional rDVM notes/comments:\n\n${notes}`
        : `${label}\n\nPlease summarize these discharge notes.`;

      try {
        const message = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          system: systemPrompt,
          messages: [
            { role: "user", content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
              { type: "text", text: userText },
            ]},
          ],
        });
        const block = message.content[0];
        const chunkText = block.type === "text" ? block.text : "";
        partialSummaries.push(chunkText);

        const newChunksComplete = chunkIndex + 1;
        const isLastChunk = newChunksComplete === chunks.length;

        if (isLastChunk) {
          // All chunks summarized — mark as "consolidating", client will poll once more
          summaryRecord = await prisma.summary.update({
            where: { id: summaryRecord.id },
            data: { status: "consolidating", chunksComplete: newChunksComplete, chunkSummaries: JSON.stringify(partialSummaries) },
          });
          return NextResponse.json({
            status: "processing",
            chunksComplete: newChunksComplete,
            totalChunks: chunks.length,
            summaryId: summaryRecord.id,
          });
        } else {
          // More chunks to go
          summaryRecord = await prisma.summary.update({
            where: { id: summaryRecord.id },
            data: { chunksComplete: newChunksComplete, chunkSummaries: JSON.stringify(partialSummaries) },
          });
          return NextResponse.json({
            status: "processing",
            chunksComplete: newChunksComplete,
            totalChunks: chunks.length,
            summaryId: summaryRecord.id,
          });
        }
      } catch (err: unknown) {
        const apiError = err as { status?: number; error?: { error?: { message?: string } } };
        const msg = apiError.error?.error?.message || "Failed to process PDF";
        return NextResponse.json({ error: msg }, { status: apiError.status || 500 });
      }
    }
  }

  return NextResponse.json({ summary: summaryRecord, status: summaryRecord.status });
}

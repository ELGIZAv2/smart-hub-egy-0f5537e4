import jsPDF from "jspdf";
import { generateBuilderSchema, uploadArtifact } from "./aiSchema";
import type { BuilderResult, LetterSchema } from "./types";

export async function buildLetter(topic: string, brief?: unknown): Promise<BuilderResult> {
  const schema = await generateBuilderSchema<LetterSchema>("letter", topic, { brief });
  if (!schema) {
    return { title: topic, summary: "Letter generation failed. Please try again." };
  }

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = 64;
  const cw = pw - margin * 2;
  let y = margin;

  pdf.setTextColor(20, 20, 20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  if (schema.sender?.name) pdf.text(schema.sender.name, margin, y);
  y += 18;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  if (schema.sender?.address) { pdf.text(schema.sender.address, margin, y); y += 14; }
  if (schema.sender?.email) { pdf.text(schema.sender.email, margin, y); y += 14; }
  y += 24;

  if (schema.date) { pdf.text(schema.date, margin, y); y += 24; }

  if (schema.recipient?.name) {
    pdf.setFont("helvetica", "bold");
    pdf.text(schema.recipient.name, margin, y);
    y += 14;
  }
  if (schema.recipient?.address) {
    pdf.setFont("helvetica", "normal");
    pdf.text(schema.recipient.address, margin, y);
    y += 14;
  }
  y += 18;

  if (schema.subject) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(`Subject: ${schema.subject}`, margin, y);
    y += 24;
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  const paragraphs = (schema.body || "").split(/\n{2,}/);
  for (const p of paragraphs) {
    const lines = pdf.splitTextToSize(p, cw);
    for (const line of lines) {
      if (y > ph - margin) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y);
      y += 16;
    }
    y += 10;
  }

  if (schema.closing) {
    y += 12;
    const closing = pdf.splitTextToSize(schema.closing, cw);
    for (const line of closing) {
      if (y > ph - margin) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y);
      y += 16;
    }
  }

  const blob = pdf.output("blob");
  const safe = (schema.subject || "letter").replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 50);
  const url = await uploadArtifact(blob, `${safe}.pdf`);

  return {
    title: schema.subject || "Letter",
    summary: `Your letter${schema.recipient?.name ? ` to ${schema.recipient.name}` : ""} is ready.`,
    downloadUrl: url ?? undefined,
    mimeType: "application/pdf",
  };
}

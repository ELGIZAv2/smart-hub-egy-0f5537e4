import jsPDF from "jspdf";
import { generateBuilderSchema, uploadArtifact } from "./aiSchema";
import type { BuilderResult, DocumentSchema } from "./types";
import { searchPexelsImages } from "./pexelsClient";

/** Build a clean typographic document and export it as a multi-page PDF. */
export async function buildDocument(topic: string, brief?: unknown): Promise<BuilderResult> {
  const schema = await generateBuilderSchema<DocumentSchema>("document", topic, { brief });
  if (!schema) {
    return { title: topic, summary: "Document generation failed. Please try again." };
  }

  // Optional hero image from Pexels.
  let heroUrl: string | undefined;
  if (schema.hero_image_query) {
    const photos = await searchPexelsImages(schema.hero_image_query, 1);
    heroUrl = photos[0]?.src;
  }

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;

  // Cover.
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(34);
  const titleLines = pdf.splitTextToSize(schema.title || "Untitled", contentWidth);
  pdf.text(titleLines, margin, pageHeight / 2 - 20);
  if (schema.subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(14);
    pdf.setTextColor(200, 200, 200);
    const subLines = pdf.splitTextToSize(schema.subtitle, contentWidth);
    pdf.text(subLines, margin, pageHeight / 2 + 20);
  }

  // Body sections.
  pdf.addPage();
  pdf.setTextColor(20, 20, 20);
  let y = margin;
  for (const section of schema.sections || []) {
    if (y > pageHeight - margin - 60) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    const headLines = pdf.splitTextToSize(section.heading, contentWidth);
    pdf.text(headLines, margin, y);
    y += headLines.length * 22 + 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    const body = pdf.splitTextToSize(section.body, contentWidth);
    for (const line of body) {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 16;
    }
    y += 18;
  }

  const blob = pdf.output("blob");
  const safe = (schema.title || "document").replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 50);
  const url = await uploadArtifact(blob, `${safe}.pdf`);

  const previewHtml = `
    <div style="font-family:Georgia,serif;max-width:780px;margin:0 auto;padding:48px 32px;color:#1a1a1a;">
      ${heroUrl ? `<img src="${heroUrl}" style="width:100%;height:280px;object-fit:cover;border-radius:12px;margin-bottom:32px;" />` : ""}
      <h1 style="font-size:36px;margin:0 0 12px;">${escapeHtml(schema.title)}</h1>
      ${schema.subtitle ? `<p style="font-size:18px;color:#666;margin:0 0 32px;">${escapeHtml(schema.subtitle)}</p>` : ""}
      ${(schema.sections || []).map(s => `
        <h2 style="font-size:22px;margin:32px 0 12px;">${escapeHtml(s.heading)}</h2>
        <p style="line-height:1.7;font-size:15px;">${escapeHtml(s.body).replace(/\n/g, "<br/>")}</p>
      `).join("")}
    </div>
  `;

  return {
    title: schema.title,
    summary: `Your document "${schema.title}" is ready with ${schema.sections?.length ?? 0} sections.`,
    downloadUrl: url ?? undefined,
    previewHtml,
    mimeType: "application/pdf",
  };
}

function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

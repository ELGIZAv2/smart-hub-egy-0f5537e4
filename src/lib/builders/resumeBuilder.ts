import jsPDF from "jspdf";
import { generateBuilderSchema, uploadArtifact } from "./aiSchema";
import type { BuilderResult, ResumeSchema } from "./types";

/** Build a modern single-column resume as a vector PDF. */
export async function buildResume(topic: string, brief?: unknown): Promise<BuilderResult> {
  const schema = await generateBuilderSchema<ResumeSchema>("resume", topic, { brief });
  if (!schema) {
    return { title: topic, summary: "Resume generation failed. Please try again." };
  }

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header strip.
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, 110, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.text(schema.name || "Your Name", margin, 56);
  if (schema.headline) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(13);
    pdf.setTextColor(200, 210, 230);
    pdf.text(schema.headline, margin, 80);
  }
  // Contact line.
  if (schema.contact) {
    pdf.setFontSize(10);
    const parts = [schema.contact.email, schema.contact.phone, schema.contact.location, schema.contact.website].filter(Boolean) as string[];
    pdf.text(parts.join("  ·  "), margin, 100);
  }
  y = 140;
  pdf.setTextColor(20, 20, 20);

  const sectionTitle = (label: string) => {
    if (y > pageHeight - margin - 40) { pdf.addPage(); y = margin; }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(15, 23, 42);
    pdf.text(label.toUpperCase(), margin, y);
    pdf.setDrawColor(220, 220, 220);
    pdf.line(margin, y + 4, pageWidth - margin, y + 4);
    y += 22;
    pdf.setTextColor(20, 20, 20);
  };

  const writeWrapped = (text: string, font: "normal" | "bold" = "normal", size = 11) => {
    pdf.setFont("helvetica", font);
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      if (y > pageHeight - margin) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y);
      y += size + 4;
    }
  };

  if (schema.summary) {
    sectionTitle("Summary");
    writeWrapped(schema.summary);
    y += 6;
  }

  if (schema.experience?.length) {
    sectionTitle("Experience");
    for (const exp of schema.experience) {
      writeWrapped(`${exp.role} — ${exp.company}`, "bold", 12);
      if (exp.period) writeWrapped(exp.period, "normal", 10);
      for (const b of exp.bullets || []) writeWrapped(`•  ${b}`, "normal", 11);
      y += 6;
    }
  }

  if (schema.education?.length) {
    sectionTitle("Education");
    for (const ed of schema.education) {
      writeWrapped(`${ed.degree} — ${ed.school}`, "bold", 12);
      if (ed.period) writeWrapped(ed.period, "normal", 10);
      y += 4;
    }
  }

  if (schema.skills?.length) {
    sectionTitle("Skills");
    writeWrapped(schema.skills.join("  •  "));
  }
  if (schema.languages?.length) {
    sectionTitle("Languages");
    writeWrapped(schema.languages.join("  •  "));
  }

  const blob = pdf.output("blob");
  const safe = (schema.name || "resume").replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 50);
  const url = await uploadArtifact(blob, `${safe}-resume.pdf`);

  return {
    title: `${schema.name || "Resume"} — Resume`,
    summary: `Resume for ${schema.name || "you"} is ready (${(schema.experience?.length ?? 0)} roles, ${(schema.skills?.length ?? 0)} skills).`,
    downloadUrl: url ?? undefined,
    mimeType: "application/pdf",
  };
}

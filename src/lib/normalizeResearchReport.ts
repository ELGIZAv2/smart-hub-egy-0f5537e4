// Robust Markdown normalizer for Deep Research reports.
// Goals:
//  - Strip leaked thinking / tool blocks.
//  - Strip inline images (gallery handles them separately).
//  - Repair headings/lists/tables/blockquotes that the model may emit malformed.
//  - Preserve RTL/Arabic content. Never merge list items or table rows into paragraphs.

const ARABIC_REGEX = /[\u0600-\u06FF]/;

const isHeading = (line: string) => /^#{1,6}\s/.test(line);
const isListItem = (line: string) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);
const isTableLine = (line: string) => /^\|.*\|\s*$/.test(line);
const isTableSeparator = (line: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
const isBlockquote = (line: string) => /^>\s?/.test(line);
const isFence = (line: string) => /^(```|~~~)/.test(line.trim());
const isHorizontalRule = (line: string) => /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);

const normalizeInlineSpacing = (line: string) =>
  line
    .replace(/[\u00A0]/g, " ")
    .replace(/([\u0600-\u06FF])([A-Za-z0-9])/g, "$1 $2")
    .replace(/([A-Za-z0-9])([\u0600-\u06FF])/g, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();

const stripInlineImages = (raw: string) =>
  raw
    // Markdown images: ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Bare HTML images
    .replace(/<img\b[^>]*>/gi, "");

const normalizeRawReport = (raw: string) =>
  stripInlineImages(raw)
    // remove tool/internal leakage
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/^\s*>\s*(thinking|reasoning|internal)[\s\S]*?(?=\n##|\n#|$)/gim, "")
    // unify whitespace
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    // bullets variants -> markdown bullets
    .replace(/^[\s]*[•●◦∙·▪▫■□]\s+/gm, "- ")
    // headings without space after #
    .replace(/^(#{1,6})([^\s#])/gm, "$1 $2")
    // ordered list items without space
    .replace(/^(\s*\d+\.)([^\s])/gm, "$1 $2")
    // ensure blank line before block elements
    .replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2")
    .replace(/([^\n])\n(\|.+\|)/g, "$1\n\n$2")
    .replace(/([^\n])\n(>\s)/g, "$1\n\n$2")
    .replace(/([^\n])\n([-*+]\s)/g, "$1\n\n$2")
    .replace(/([^\n])\n(\d+\.\s)/g, "$1\n\n$2")
    // split bullets glued to a paragraph
    .replace(/([^\s\n])\s+([-*+])\s+(?=\S)/g, (match, prefix, bullet) =>
      /[\])]/.test(prefix) ? match : `${prefix}\n\n${bullet} `,
    )
    .replace(/([^\s\n])\s+(\d+\.)\s+(?=\S)/g, (match, prefix, marker) =>
      /[\])]/.test(prefix) ? match : `${prefix}\n\n${marker} `,
    )
    .replace(/\n{3,}/g, "\n\n");

// Repair tables: ensure a separator row exists right after the header row.
const repairTables = (lines: string[]): string[] => {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);
    if (isTableLine(line.trim())) {
      const next = lines[i + 1]?.trim() ?? "";
      const isHeaderRow = !isTableSeparator(line.trim()) && (i === 0 || !isTableLine(lines[i - 1]?.trim() ?? ""));
      if (isHeaderRow && !isTableSeparator(next)) {
        const cellCount = line.split("|").filter((s) => s.trim().length > 0).length || 2;
        out.push("| " + Array(cellCount).fill("---").join(" | ") + " |");
      }
    }
  }
  return out;
};

export const normalizeResearchReport = (raw: string): string => {
  if (!raw) return "";

  const pre = normalizeRawReport(raw).split("\n");
  const lines = repairTables(pre);
  const output: string[] = [];
  let inFence = false;
  let previousKind: "blank" | "paragraph" | "list" | "table" | "blockquote" | "code" = "blank";

  const pushBlank = () => {
    if (output.length && output[output.length - 1] !== "") {
      output.push("");
    }
    previousKind = "blank";
  };

  for (const rawLine of lines) {
    const trimmedRight = rawLine.replace(/[ \t]+$/g, "");
    const trimmed = trimmedRight.trim();

    if (!trimmed) {
      pushBlank();
      continue;
    }

    if (isFence(trimmed)) {
      if (previousKind !== "blank") pushBlank();
      output.push(trimmedRight);
      inFence = !inFence;
      previousKind = "code";
      continue;
    }

    if (inFence) {
      output.push(trimmedRight);
      previousKind = "code";
      continue;
    }

    if (isHeading(trimmed) || isHorizontalRule(trimmed)) {
      pushBlank();
      output.push(trimmed);
      pushBlank();
      continue;
    }

    if (isTableLine(trimmed)) {
      if (previousKind !== "table" && previousKind !== "blank") pushBlank();
      output.push(trimmed);
      previousKind = "table";
      continue;
    }

    if (isListItem(trimmed)) {
      if (previousKind !== "list" && previousKind !== "blank") pushBlank();
      output.push(normalizeInlineSpacing(trimmed));
      previousKind = "list";
      continue;
    }

    if (previousKind === "list" && /^\s{2,}\S/.test(trimmedRight)) {
      output[output.length - 1] = `${output[output.length - 1]} ${normalizeInlineSpacing(trimmed)}`;
      continue;
    }

    if (isBlockquote(trimmed)) {
      if (previousKind !== "blockquote" && previousKind !== "blank") pushBlank();
      output.push(normalizeInlineSpacing(trimmed));
      previousKind = "blockquote";
      continue;
    }

    const normalizedParagraph = normalizeInlineSpacing(trimmed);

    if (previousKind === "paragraph") {
      output[output.length - 1] = `${output[output.length - 1]} ${normalizedParagraph}`.replace(/\s{2,}/g, " ").trim();
      continue;
    }

    if (previousKind !== "blank") pushBlank();
    output.push(normalizedParagraph);
    previousKind = "paragraph";
  }

  while (output[output.length - 1] === "") {
    output.pop();
  }

  return output.join("\n");
};

export const detectResearchReportDirection = (report: string) =>
  ARABIC_REGEX.test(report) ? "rtl" : "ltr";

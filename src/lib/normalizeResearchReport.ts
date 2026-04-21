const ARABIC_REGEX = /[\u0600-\u06FF]/;

const isHeading = (line: string) => /^#{1,6}\s/.test(line);
const isListItem = (line: string) => /^\s*(?:[-*+]\s+|\d+\.\s+)/.test(line);
const isTableLine = (line: string) => /^\|.*\|\s*$/.test(line);
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

const normalizeRawReport = (raw: string) =>
  raw
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/^\s*>\s*(thinking|reasoning|internal)[\s\S]*?(?=\n##|\n#|$)/gim, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/^[\s]*[•●◦∙·]\s+/gm, "- ")
    .replace(/^(#{1,6})([^\s#])/gm, "$1 $2")
    .replace(/^(\s*\d+\.)([^\s])/gm, "$1 $2")
    .replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2")
    .replace(/([^\n])\n(\|.+\|)/g, "$1\n\n$2")
    .replace(/([^\n])\n(>\s)/g, "$1\n\n$2")
    .replace(/([^\n])\n([-*+]\s)/g, "$1\n\n$2")
    .replace(/([^\n])\n(\d+\.\s)/g, "$1\n\n$2")
    .replace(/([^\s\n])\s+([-*+])\s+(?=\S)/g, (match, prefix, bullet) =>
      /[\])]/.test(prefix) ? match : `${prefix}\n\n${bullet} `,
    )
    .replace(/([^\s\n])\s+(\d+\.)\s+(?=\S)/g, (match, prefix, marker) =>
      /[\])]/.test(prefix) ? match : `${prefix}\n\n${marker} `,
    )
    .replace(/\n{3,}/g, "\n\n");

export const normalizeResearchReport = (raw: string): string => {
  if (!raw) return "";

  const lines = normalizeRawReport(raw).split("\n");
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
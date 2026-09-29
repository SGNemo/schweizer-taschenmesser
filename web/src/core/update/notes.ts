/**
 * A short plain-text preview of Markdown release notes. Nothing is rendered as HTML: headings
 * and list markers are stripped, links keep only their text.
 */
export function notesPreview(markdown: string, maxLines = 10): string[] {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s*/, '')
        .replace(/^\s*[-*+]\s+/, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/^\*\*Full changelog:\*\*.*$/i, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .trim(),
    )
    // The release title line ("1.2.0 (2026-10-01)") adds nothing the banner does not say.
    .filter(
      (line, i) =>
        line !== '' && !(i === 0 && /^\d+\.\d+\.\d+\S*\s*\(\d{4}-\d{2}-\d{2}\)$/.test(line)),
    );
  return lines.length > maxLines ? [...lines.slice(0, maxLines), '…'] : lines;
}

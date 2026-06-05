/**
 * Strip markdown symbols so responses render as clean plain text.
 * Gemini sometimes adds ** or # even when told not to.
 */
export function cleanMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")           // remove # headings
    .replace(/\*\*(.+?)\*\*/g, "$1")     // remove **bold**
    .replace(/\*(.+?)\*/g, "$1")         // remove *italic*
    .replace(/_{2}(.+?)_{2}/g, "$1")     // remove __bold__
    .replace(/_(.+?)_/g, "$1")           // remove _italic_
    .replace(/`{1,3}[^`]*`{1,3}/g, "")  // remove `code`
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // remove [links](url)
    .replace(/^\s*[-•]\s+/gm, "- ")     // normalise bullet chars
    .replace(/\n{3,}/g, "\n\n")          // collapse excessive newlines
    .trim();
}

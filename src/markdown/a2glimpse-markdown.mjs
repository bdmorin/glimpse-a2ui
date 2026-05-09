// a2glimpse-markdown - minimal allowlist markdown engine for the vendored
// Lit renderer's "@a2ui/markdown-it" import slot.
//
// TRUST BOUNDARY DOCUMENT - read before changing anything in this file.
//
// The vendored Lit renderer's MarkdownDirective dynamic-imports
// "@a2ui/markdown-it", awaits renderMarkdown(value, options), and pipes
// the returned STRING through Lit's unsafeHTML directive - i.e. the
// directive injects whatever we return as raw HTML into the DOM, no
// further sanitization.
//
// Therefore this module IS the trust boundary for the Text.usageHint
// pipeline. Any HTML it emits will be trusted. The input value is
// agent-controlled (flows in via stdin -> A2UI surfaceUpdate -> Text
// component -> MarkdownDirective).
//
// Strategy:
//   1. HTML-escape the ENTIRE input first.
//   2. Tokenize the escaped string by line.
//   3. Re-introduce a FIXED allowlist of structural HTML by recognizing
//      markdown patterns AGAINST THE ESCAPED TEXT. Because we work on
//      already-escaped text, any pre-existing HTML in the input is inert
//      and cannot be reanimated.
//   4. Never emit script, iframe, style, object, embed, link, event-
//      handler attributes, javascript: URLs, or data: URLs.
//
// Output allowlist (the ONLY tags this module will ever emit):
//   h1..h6, p, strong, em, code, pre, ul, ol, li,
//   a (href restricted to http/https/mailto/relative), br

const HTML_ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function safeUrl(raw) {
  const decoded = raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const m = /^([A-Za-z][A-Za-z0-9+.\-]*):/.exec(decoded);
  if (m) {
    const scheme = m[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https" && scheme !== "mailto") return null;
  }
  if (/[\x00-\x1f\x7f]/.test(decoded)) return null;
  return raw;
}

function renderInline(escaped) {
  let out = escaped;
  out = out.replace(/`([^`\n]+)`/g, (_, body) => `<code>${body}</code>`);
  out = out.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
    const safe = safeUrl(url);
    if (safe === null) return m;
    return `<a href="${safe}" rel="noopener noreferrer">${text}</a>`;
  });
  out = out.replace(/\*\*([^*\n]+)\*\*/g, (_, body) => `<strong>${body}</strong>`);
  out = out.replace(/__([^_\n]+)__/g, (_, body) => `<strong>${body}</strong>`);
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, (_, pre, body) => `${pre}<em>${body}</em>`);
  out = out.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, (_, pre, body) => `${pre}<em>${body}</em>`);
  return out;
}

function classAttr(tagClassMap, tag) {
  if (!tagClassMap || typeof tagClassMap !== "object") return "";
  const v = tagClassMap[tag];
  if (!v || typeof v !== "object") return "";
  const classes = Object.keys(v).filter((k) => v[k] && /^[A-Za-z0-9 _\-]+$/.test(k));
  if (classes.length === 0) return "";
  return ` class="${classes.join(" ")}"`;
}

function renderBlocks(text, tagClassMap) {
  const escaped = escapeHtml(text);
  const lines = escaped.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = renderInline(h[2]);
      out.push(`<h${level}${classAttr(tagClassMap, "h" + level)}>${content}</h${level}>`);
      i++;
      continue;
    }
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      if (i < lines.length) i++;
      out.push(`<pre><code>${buf.join("\n")}</code></pre>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const m = /^\s*[-*]\s+(.*)$/.exec(lines[i]);
        items.push(`<li${classAttr(tagClassMap, "li")}>${renderInline(m[1])}</li>`);
        i++;
      }
      out.push(`<ul${classAttr(tagClassMap, "ul")}>${items.join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const m = /^\s*\d+\.\s+(.*)$/.exec(lines[i]);
        items.push(`<li${classAttr(tagClassMap, "li")}>${renderInline(m[1])}</li>`);
        i++;
      }
      out.push(`<ol${classAttr(tagClassMap, "ol")}>${items.join("")}</ol>`);
      continue;
    }
    const buf = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) { buf.push(lines[i]); i++; }
    out.push(`<p${classAttr(tagClassMap, "p")}>${renderInline(buf.join("<br>"))}</p>`);
  }
  return out.join("");
}

export async function renderMarkdown(value, options) {
  if (value == null) return "";
  const tagClassMap = options && options.tagClassMap;
  return renderBlocks(String(value), tagClassMap);
}

export default { renderMarkdown };

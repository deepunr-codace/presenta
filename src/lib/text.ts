/**
 * Shared text helpers for the HTML that text elements carry: entity decoding,
 * escaping, tag stripping and an allow-list sanitiser. Pure string functions,
 * safe on the server and in the browser.
 */

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  yen: "¥",
  deg: "°",
  times: "×",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  szlig: "ß",
};

const MAX_CODE_POINT = 0x10ffff;

function isScalarCodePoint(n: number): boolean {
  return Number.isInteger(n) && n > 0 && n <= MAX_CODE_POINT && !(n >= 0xd800 && n <= 0xdfff);
}

/**
 * Decode HTML entities in one pass: named entities from a fixed table,
 * decimal and hex numeric references. Malformed references (`&#;`, `&#xZZ;`),
 * unknown names and numbers outside the Unicode scalar range are left as they
 * are, and the output is never decoded again (`&amp;lt;` becomes `&lt;`).
 */
export function decodeEntities(input: string): string {
  if (input.indexOf("&") === -1) return input;
  return input.replace(/&(#[xX][0-9a-fA-F]{1,8}|#[0-9]{1,8}|[a-zA-Z][a-zA-Z0-9]{0,31});/g, (match, code: string) => {
    if (code[0] === "#") {
      const hex = code[1] === "x" || code[1] === "X";
      const n = hex ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return isScalarCodePoint(n) ? String.fromCodePoint(n) : match;
    }
    const named = NAMED_ENTITIES[code] ?? NAMED_ENTITIES[code.toLowerCase()];
    return named ?? match;
  });
}

/** Escape the four characters that matter inside HTML text and attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SCRIPT_BLOCKS = /<(script|style|iframe|object|embed|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const TAG = /<\/?[a-zA-Z][^>]*>|<!--[\s\S]*?-->/g;

/**
 * Plain text from Tiptap HTML: `<br>` and block closings become newlines,
 * tags are dropped, entities decoded once, whitespace collapsed per line and
 * empty lines removed.
 */
export function htmlToText(html: string): string {
  if (!html) return "";
  const withBreaks = html
    .replace(SCRIPT_BLOCKS, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(?:p|li|div|h[1-6]|ul|ol|blockquote)\s*>/gi, "\n")
    .replace(TAG, "");
  return decodeEntities(withBreaks)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Remove every tag (and script-like blocks with their content) but keep the text and its entities as they are. */
export function stripTags(html: string): string {
  if (!html || html.indexOf("<") === -1) return html;
  return html.replace(SCRIPT_BLOCKS, "").replace(TAG, "");
}

/** Tags a text element may carry; everything else is dropped, and no attribute survives. */
const ALLOWED_TAGS: ReadonlySet<string> = new Set(["p", "ul", "ol", "li", "strong", "em", "b", "i", "br", "u"]);

/** A complete tag or comment; an unterminated `<` is left to the text path and escaped there. */
const TOKEN = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>|<!--[\s\S]*?-->/g;

/**
 * Allow-list sanitiser for element HTML coming from the model or an imported
 * file. Keeps `p ul ol li strong em b i br u` without attributes, drops every
 * other tag (and script-like blocks with their content), and escapes stray
 * `<` / `>` characters in text so the result is always well-formed markup.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  const source = html.replace(SCRIPT_BLOCKS, "");
  if (source.indexOf("<") === -1) return source;
  let out = "";
  let last = 0;
  for (const m of source.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) out += escapeAngles(source.slice(last, index));
    last = index + m[0].length;
    const tag = m[1]?.toLowerCase();
    if (!tag || !ALLOWED_TAGS.has(tag)) continue;
    if (tag === "br") {
      out += "<br>";
      continue;
    }
    out += m[0].startsWith("</") ? `</${tag}>` : `<${tag}>`;
  }
  if (last < source.length) out += escapeAngles(source.slice(last));
  return out;
}

function escapeAngles(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

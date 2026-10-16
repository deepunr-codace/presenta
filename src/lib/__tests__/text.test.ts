import { describe, expect, it } from "vitest";
import { decodeEntities, escapeHtml, htmlToText, sanitizeHtml, stripTags } from "../text";

describe("decodeEntities", () => {
  it("decodes named, decimal and hex references", () => {
    expect(decodeEntities("Fish &amp; chips &lt;ok&gt; &quot;q&quot; &#39;a&#39; &#x41; &#X42; &eacute; &mdash;")).toBe(
      "Fish & chips <ok> \"q\" 'a' A B é —",
    );
  });

  it("leaves malformed references untouched instead of throwing", () => {
    for (const s of ["&#;", "&#x;", "&#xZZ;", "&#x;&#;", "&;", "&bogus;", "& #65;", "&#65", "a &# b"]) {
      expect(() => decodeEntities(s)).not.toThrow();
      expect(decodeEntities(s)).toBe(s);
    }
  });

  it("leaves out-of-range and surrogate code points untouched", () => {
    expect(decodeEntities("&#1114112;")).toBe("&#1114112;");
    expect(decodeEntities("&#x110000;")).toBe("&#x110000;");
    expect(decodeEntities("&#99999999;")).toBe("&#99999999;");
    expect(decodeEntities("&#55296;")).toBe("&#55296;");
    expect(decodeEntities("&#xD800;")).toBe("&#xD800;");
    expect(decodeEntities("&#0;")).toBe("&#0;");
    expect(decodeEntities("&#1114111;")).toBe("\u{10FFFF}");
  });

  it("decodes in a single pass: the result is never decoded again", () => {
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
    expect(decodeEntities("&amp;amp;")).toBe("&amp;");
    expect(decodeEntities("&amp;#60;")).toBe("&#60;");
  });
});

describe("htmlToText", () => {
  it("turns blocks into lines, drops tags and decodes once", () => {
    expect(htmlToText("<ul><li>One &amp; two</li><li>Three<br>Four</li></ul>")).toBe("One & two\nThree\nFour");
    expect(htmlToText("<p>  a   b </p><p></p><p>c</p>")).toBe("a b\nc");
    expect(htmlToText("")).toBe("");
  });

  it("decodes entities exactly once", () => {
    expect(htmlToText("<p>A &amp;amp; B</p>")).toBe("A &amp; B");
    expect(htmlToText("<p>&amp;lt;script&amp;gt;</p>")).toBe("&lt;script&gt;");
    expect(htmlToText("<p>&#xZZ; stays</p>")).toBe("&#xZZ; stays");
  });

  it("does not throw on malformed entities inside markup", () => {
    expect(htmlToText("<p>&#xZZ; &#; &#99999999;</p>")).toBe("&#xZZ; &#; &#99999999;");
  });

  it("drops script and style blocks with their content", () => {
    expect(htmlToText("<p>Hi</p><script>alert(1)</script><style>p{}</style>")).toBe("Hi");
  });
});

describe("sanitizeHtml", () => {
  it("keeps the allow-listed tags and strips every attribute", () => {
    expect(sanitizeHtml('<p class="x" onclick="evil()">Hi <strong style="a">bold</strong> <em>soft</em> <u>u</u> <b>b</b> <i>i</i></p>')).toBe(
      "<p>Hi <strong>bold</strong> <em>soft</em> <u>u</u> <b>b</b> <i>i</i></p>",
    );
    expect(sanitizeHtml("<ul><li>One</li><li>Two<br/>Three</li></ul><ol><li>x</li></ol>")).toBe(
      "<ul><li>One</li><li>Two<br>Three</li></ul><ol><li>x</li></ol>",
    );
  });

  it("drops disallowed tags, their attributes and script bodies", () => {
    expect(sanitizeHtml('<p>Hi<img src=x onerror="alert(1)"></p>')).toBe("<p>Hi</p>");
    expect(sanitizeHtml("<script>alert(1)</script><p>ok</p>")).toBe("<p>ok</p>");
    expect(sanitizeHtml('<a href="javascript:alert(1)">link</a>')).toBe("link");
    expect(sanitizeHtml("<svg onload=alert(1)><circle/></svg>text")).toBe("text");
    expect(sanitizeHtml('<iframe src="https://evil.example"></iframe>after')).toBe("after");
    expect(sanitizeHtml("<P ONCLICK=x>upper</P>")).toBe("<p>upper</p>");
  });

  it("escapes stray angle brackets so the output is always well formed", () => {
    expect(sanitizeHtml("a < b and c > d")).toBe("a &lt; b and c &gt; d");
    expect(sanitizeHtml("<p>1 < 2</p>")).toBe("<p>1 &lt; 2</p>");
    expect(sanitizeHtml("<img src=x onerror=alert(1)")).toBe("&lt;img src=x onerror=alert(1)");
    expect(sanitizeHtml("<!-- c --><p>x</p>")).toBe("<p>x</p>");
  });

  it("passes plain text and entities through unchanged", () => {
    expect(sanitizeHtml("Fish &amp; chips &lt;ok&gt;")).toBe("Fish &amp; chips &lt;ok&gt;");
    expect(sanitizeHtml("")).toBe("");
  });
});

describe("stripTags and escapeHtml", () => {
  it("stripTags removes tags but keeps words and entities", () => {
    expect(stripTags("<b>Bold</b> &amp; <script>x()</script>plain")).toBe("Bold &amp; plain");
    expect(stripTags("a < b")).toBe("a < b");
  });

  it("escapeHtml escapes the four significant characters", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});

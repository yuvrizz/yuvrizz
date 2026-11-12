const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");

const FEED_URL = "https://medium.com/feed/@yuvrizz";
const OUTPUT_DIR = path.join(__dirname, "../assets");

const COLORS = {
  background: "#101813",
  border: "#293a2e",
  title: "#e8f0e7",
  muted: "#82958a",
  accent: "#b9ff66",
  panel: "#142019"
};

function escapeXml(value = "") {
  return String(value).replace(/[<>&"']/g, char => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;"
  })[char]);
}

// Decode common HTML entities and remove HTML tags.
function stripHtml(html = "") {
  return String(html)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract the first meaningful text block as the subtitle.
function extractSubtitle(article) {
  const html = String(
    article.description || article["content:encoded"] || ""
  );

  const title = stripHtml(article.title || "");

  // Extract paragraph or heading blocks.
  const blocks = html.match(
    /<(?:h[2-6]|p)\b[^>]*>[\s\S]*?<\/(?:h[2-6]|p)>/gi
  ) || [];

  for (const block of blocks) {
    const text = stripHtml(block);

    if (
      text &&
      text !== title &&
      !text.startsWith("Image source:")
    ) {
      return text;
    }
  }

  // Fallback if the RSS content has no paragraph tags.
  const fallback = stripHtml(html);

  return fallback === title ? "" : fallback;
}

// Prevent long titles and subtitles from overflowing.
function truncateText(text, maxLength) {
  const value = String(text || "").trim();

  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength - 1).trimEnd() + "…";
}

function createCard(article, index) {
  const rawTitle = stripHtml(article.title || "Untitled");
  const rawSubtitle = extractSubtitle(article);

  const title = escapeXml(truncateText(rawTitle, 95));
  const description = escapeXml(truncateText(rawSubtitle, 145));

  const link = escapeXml(
    article.link || "https://medium.com/@yuvrizz"
  );

  const date = article.pubDate
    ? new Date(article.pubDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      }).toUpperCase()
    : "RECENTLY PUBLISHED";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="1000" height="220"
     viewBox="0 0 1000 220"
     role="img" aria-labelledby="title">

  <title id="title">${title}</title>

  <rect width="1000" height="220" rx="10"
        fill="${COLORS.background}"/>

  <rect x="1" y="1" width="998" height="218"
        rx="9" fill="none"
        stroke="${COLORS.border}"/>

  <rect x="0" y="0" width="5" height="220"
        rx="2" fill="${COLORS.accent}"/>

  <text x="35" y="38"
        font-family="monospace"
        font-size="13"
        letter-spacing="2"
        fill="${COLORS.accent}">
    WRITING / 0${index + 1}
  </text>

  <text x="965" y="38"
        text-anchor="end"
        font-family="monospace"
        font-size="12"
        fill="${COLORS.muted}">
    MEDIUM · ${escapeXml(date)}
  </text>

  <text x="35" y="91"
        font-family="Arial, Helvetica, sans-serif"
        font-size="26"
        font-weight="bold"
        fill="${COLORS.title}">
    ${title}
  </text>

  <text x="35" y="127"
        font-family="Arial, Helvetica, sans-serif"
        font-size="14"
        fill="${COLORS.muted}">
    ${description}
  </text>

  <path d="M35 158H965"
        stroke="${COLORS.border}"/>

  <text x="35" y="190"
        font-family="monospace"
        font-size="12"
        letter-spacing="1"
        fill="${COLORS.accent}">
    READ ARTICLE →
  </text>

  <text x="965" y="190"
        text-anchor="end"
        font-family="monospace"
        font-size="12"
        fill="${COLORS.muted}">
    YUVRIZZ / BLOG
  </text>

  <a href="${link}">
    <rect width="1000" height="220"
          fill="transparent"/>
  </a>
</svg>`;
}

async function main() {
  const response = await fetch(FEED_URL);

  if (!response.ok) {
    throw new Error(
      `Medium RSS request failed: ${response.status}`
    );
  }

  const xml = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    cdataPropName: "__cdata"
  });

  const parsed = parser.parse(xml);

  let articles = parsed.rss?.channel?.item || [];

  if (!Array.isArray(articles)) {
    articles = [articles];
  }

  articles = articles.slice(0, 2);

  if (articles.length === 0) {
    throw new Error("No Medium articles found in RSS feed.");
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  articles.forEach((article, index) => {
    const filename = `medium-${index + 1}.svg`;
    const filepath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(
      filepath,
      createCard(article, index),
      "utf8"
    );

    console.log(
      `Generated ${filename}: ${article.title}`
    );
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

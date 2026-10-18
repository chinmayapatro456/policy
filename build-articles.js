// build-articles.js
// Reads every .docx file in the /articles folder and writes js/data-docs.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const mammoth = require('mammoth');

const TOPICS = ['history', 'geography', 'polity', 'diplomacy', 'philosophy',
  'culture', 'society', 'ethics', 'governance', 'books', 'literature', 'misc'];

const META_KEYS = {
  'title': 'title',
  'topic': 'topic',
  'summary': 'summary',
  'date': 'date',
  'image': 'image',
  'image description': 'imageAlt'
};

const STYLE_MAP = [
  "p[style-name='Heading 1'] => h2:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Quote'] => blockquote:fresh"
];

function stripTags(s) { return s.replace(/<[^>]*>/g, ''); }

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// Date the file was first added to the repository (keeps old essays from changing date)
function firstAddedDate(relPath) {
  try {
    const out = execFileSync('git', ['log', '--diff-filter=A', '--format=%cI', '--', relPath],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const lines = out.split('\n').filter(Boolean);
    if (lines.length) return new Date(lines[lines.length - 1]);
  } catch (e) { /* fall through */ }
  return new Date();
}

async function main() {
  const dir = path.join(__dirname, 'articles');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'))
    : [];

  const out = [];
  const usedIds = new Set();

  for (const file of files) {
    try {
      const result = await mammoth.convertToHtml(
        { path: path.join(dir, file) },
        { styleMap: STYLE_MAP }
      );
      let html = result.value.trim();

      // Read the "Title: ... Topic: ..." lines at the top of the document
      const meta = {};
      while (true) {
        const m = html.match(/^<p>([\s\S]*?)<\/p>\s*/);
        if (!m) break;
        const text = decode(stripTags(m[1])).trim();
        const kv = text.match(/^([A-Za-z ]+?)\s*:\s*([\s\S]*)$/);
        if (!kv || !(kv[1].toLowerCase().trim() in META_KEYS)) break;
        meta[META_KEYS[kv[1].toLowerCase().trim()]] = kv[2].trim();
        html = html.slice(m[0].length);
      }

      if (/<img/i.test(html)) {
        console.warn(`WARNING: ${file} has pictures inside the text. They were removed. Use the "Image:" line instead.`);
        html = html.replace(/<img[^>]*>/gi, '');
      }

      const title = meta.title || file.replace(/\.docx$/i, '');
      if (!meta.title) console.warn(`WARNING: ${file} has no "Title:" line. Using the file name.`);

      let topic = (meta.topic || '').toLowerCase().trim();
      if (!TOPICS.includes(topic)) {
        console.warn(`WARNING: ${file} has topic "${meta.topic || ''}", which is not valid. Using "misc".`);
        topic = 'misc';
      }

      const added = firstAddedDate(path.join('articles', file));
      const date = meta.date || added.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
      let ts = meta.date ? Date.parse(meta.date) : NaN;
      if (isNaN(ts)) ts = added.getTime();

      const words = stripTags(html).split(/\s+/).filter(Boolean).length;
      const minutes = Math.max(1, Math.round(words / 200));

      let id = `${topic}-${slugify(title)}`;
      let n = 2;
      while (usedIds.has(id)) id = `${topic}-${slugify(title)}-${n++}`;
      usedIds.add(id);

      const item = {
        id,
        title,
        topic,
        topicLabel: topic.charAt(0).toUpperCase() + topic.slice(1),
        date,
        readingTime: `${minutes} min read`,
        summary: meta.summary || '',
        content: html,
        _ts: ts
      };
      if (meta.image) {
        item.image = meta.image;
        item.imageAlt = meta.imageAlt || title;
      }
      out.push(item);
      console.log(`OK: ${file} -> ${id}`);
    } catch (err) {
      console.warn(`ERROR: could not read ${file}: ${err.message}`);
    }
  }

  out.sort((a, b) => b._ts - a._ts || a.title.localeCompare(b.title));
  out.forEach(a => delete a._ts);

  const banner = '// AUTO-GENERATED from the .docx files in /articles. Do not edit by hand.\n';
  fs.mkdirSync(path.join(__dirname, 'js'), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, 'js', 'data-docs.js'),
    `${banner}articles.unshift(...${JSON.stringify(out, null, 2)});\n`
  );
  console.log(`Done. ${out.length} article(s) written to js/data-docs.js`);
}

main();

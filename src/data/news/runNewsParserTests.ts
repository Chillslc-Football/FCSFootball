/**
 * Small fixture-based parser checks for news sources.
 * Run: npm run test:news-parsers
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseHeroSportsRssXml } from '@/data/news/heroSportsNewsProvider';
import {
  parseTheAnalystPageArticles,
  parseTheAnalystRssXml,
} from '@/data/news/theAnalystNewsProvider';
import {
  parseAnalystHtmlArticles,
  parseAnalystJsonLdArticles,
} from '@/data/news/theAnalystStructuredFallback';
import {
  formatNewsPublishedDate,
  getNewsArticleKey,
  mergeNewsFeeds,
  normalizePublicationDate,
} from '@/data/news/newsUtils';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '__fixtures__');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8');
}

function run(): void {
  const heroRss = parseHeroSportsRssXml(readFixture('heroSportsFcs.rss.xml'));
  assert(heroRss.length === 3, `expected 3 Hero RSS articles, got ${heroRss.length}`);
  assert(
    heroRss[0]?.title.includes('Jersey Countdown'),
    'Hero RSS should sort newest first',
  );
  assert(
    heroRss[0]?.publishedAt != null && Number.isFinite(Date.parse(heroRss[0].publishedAt)),
    'Hero RSS newest article should have a valid publication date',
  );
  assert(
    heroRss.some((article) => article.url.includes('fcs-relative-link-article-test')),
    'Hero RSS should normalize relative article URLs',
  );
  assert(
    heroRss.every((article) => article.title && article.url.startsWith('https://')),
    'Hero RSS articles require title + absolute URL',
  );

  const analystRss = parseTheAnalystRssXml(readFixture('theAnalystFcs.rss.xml'));
  assert(analystRss.length === 2, `expected 2 Analyst RSS articles, got ${analystRss.length}`);
  assert(
    analystRss.every((article) => !article.url.includes('/articles/author/')),
    'Analyst RSS should reject author-index URLs',
  );
  assert(
    analystRss[0]?.title.includes('Dateline Upset City'),
    'Analyst RSS should sort newest first',
  );

  const pageHtml = readFixture('theAnalystFcsPage.html');
  const jsonLd = parseAnalystJsonLdArticles(pageHtml);
  assert(jsonLd.length >= 2, `expected JSON-LD articles, got ${jsonLd.length}`);
  assert(
    jsonLd.some((article) => article.url.includes('json-ld-featured-fcs-story')),
    'JSON-LD should parse featured item URLs',
  );
  assert(
    jsonLd.some((article) => article.url.includes('second-json-ld-story')),
    'JSON-LD should normalize relative article URLs',
  );

  // Odd date format should not discard the article.
  const oddDateArticle = jsonLd.find((article) =>
    article.url.includes('second-json-ld-story'),
  );
  assert(oddDateArticle?.title === 'Second JSON-LD Story', 'JSON-LD title required');
  assert(
    oddDateArticle?.publishedAt == null
      || Number.isFinite(Date.parse(oddDateArticle.publishedAt)),
    'Odd date formats must not invent invalid timestamps',
  );

  const htmlArticles = parseAnalystHtmlArticles(pageHtml);
  assert(
    htmlArticles.some((article) => article.url.includes('html-fallback-story-card')),
    'HTML fallback should support alternate story-card markup',
  );
  assert(
    htmlArticles.some((article) => article.url.includes('legacy-teaser-article')),
    'HTML fallback should still support legacy teaser markup',
  );
  assert(
    htmlArticles.every((article) => Boolean(article.title && article.url)),
    'HTML fallback requires title + URL',
  );

  const pageArticles = parseTheAnalystPageArticles(pageHtml);
  assert(pageArticles.length >= 2, 'page parser should prefer JSON-LD results');
  assert(
    pageArticles[0]?.source === 'The Analyst',
    'page parser should tag The Analyst source',
  );

  assert(
    normalizePublicationDate('Sun, 19 Jul 2026 15:08:36 +0000')?.startsWith('2026-07-19'),
    'RSS pubDate should normalize',
  );
  assert(
    normalizePublicationDate('not-a-date') == null,
    'invalid dates normalize to undefined without throwing',
  );

  const merged = mergeNewsFeeds([
    [
      {
        id: 'h1',
        title: 'Older Hero',
        url: 'https://herosports.com/a',
        publishedAt: '2026-07-18T12:00:00.000Z',
        source: 'HERO Sports',
      },
      {
        id: 'h2',
        title: 'Duplicate URL Hero',
        url: 'https://theanalyst.com/articles/same',
        publishedAt: '2026-07-20T12:00:00.000Z',
        source: 'HERO Sports',
      },
    ],
    [
      {
        id: 'a1',
        title: 'Newest Analyst',
        url: 'https://theanalyst.com/articles/newest',
        publishedAt: '2026-07-21T12:00:00.000Z',
        source: 'The Analyst',
      },
      {
        id: 'a2',
        title: 'Duplicate URL Analyst',
        url: 'https://theanalyst.com/articles/same',
        publishedAt: '2026-07-19T12:00:00.000Z',
        source: 'The Analyst',
      },
    ],
  ]);
  assert(merged.length === 3, `expected 3 merged articles after URL dedupe, got ${merged.length}`);
  assert(
    merged[0]?.title === 'Newest Analyst',
    'merged feed should place newest article first',
  );
  assert(
    merged.some((article) => article.source === 'HERO Sports') &&
      merged.some((article) => article.source === 'The Analyst'),
    'merged feed should include both sources',
  );

  assert(
    getNewsArticleKey(merged[0]!) === 'https://theanalyst.com/articles/newest',
    'article keys should prefer stable URL',
  );
  assert(
    formatNewsPublishedDate('2026-07-19T15:08:36.000Z') ===
      formatNewsPublishedDate('2026-07-19T15:08:36.000Z'),
    'published date formatter should be stable',
  );
  assert(
    typeof formatNewsPublishedDate('2026-07-19T15:08:36.000Z') === 'string',
    'published date formatter should return a display string',
  );

  console.log('news parser fixture tests passed');
}

run();

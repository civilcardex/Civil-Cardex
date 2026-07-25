// Updates <lastmod> dates in public/sitemap.xml to today's date during build.
// Run via: node scripts/update-sitemap.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sitemapPath = resolve(__dirname, '..', 'public', 'sitemap.xml');

const today = new Date().toISOString().split('T')[0];

let xml = readFileSync(sitemapPath, 'utf-8');

const dateRegex = /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g;
const count = (xml.match(dateRegex) || []).length;

xml = xml.replace(dateRegex, `<lastmod>${today}</lastmod>`);

writeFileSync(sitemapPath, xml, 'utf-8');

console.log(`[sitemap] Updated ${count} <lastmod> entries to ${today}`);

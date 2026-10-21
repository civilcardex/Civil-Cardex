/**
 * Regenera el baseline de focos de complejidad del guard G8.
 *
 * Uso: `node --experimental-strip-types scripts/generarBaselineComplejidad.mjs`
 *
 * Imprime el bloque `FOCOS_CONOCIDOS` y el `TOTAL_FOCOS_BASE` para pegar en
 * `src/architecture/architecture.test.ts`. Se ejecuta DESPUÉS de arreglar un archivo:
 * el guard G8 falla si el código tiene menos focos que el baseline (regla anti-congelación),
 * y este script dice el número nuevo.
 *
 * Usa el MISMO detector que el guard (src/architecture/complejidad.ts), importado directo:
 * node 22 lo ejecuta con --experimental-strip-types (sin dependencias nuevas).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';


const RAIZ = resolve(process.cwd(), 'src');

function listar(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) listar(p, acc);
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) acc.push(p);
  }
  return acc;
}

// Node 22 puede ejecutar TS directamente con --experimental-strip-types (sin build extra).
const { contarFocosPorArchivo, totalFocos } = await import(
  pathToFileURL(join(RAIZ, 'architecture', 'complejidad.ts')).href
);

const fuentes = {};
for (const p of listar(RAIZ)) {
  fuentes[relative(RAIZ, p).split(sep).join('/')] = readFileSync(p, 'utf8');
}
const conteo = contarFocosPorArchivo(fuentes);
const entradas = Object.entries(conteo)
  .filter(([, n]) => n >= 5)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const bloque = entradas.map(([f, n]) => `  '${f}': ${n},`).join('\n');
const texto = `const TOTAL_FOCOS_BASE = ${totalFocos(conteo)};\n\nconst FOCOS_CONOCIDOS: Record<string, number> = {\n${bloque}\n};`;
const destino = join(process.cwd(), 'scripts', 'baselineComplejidad.txt');
writeFileSync(destino, texto + '\n', 'utf8');
console.log(`TOTAL ${totalFocos(conteo)} | archivos con >=5: ${entradas.length}`);
console.log(`escrito en scripts/baselineComplejidad.txt`);

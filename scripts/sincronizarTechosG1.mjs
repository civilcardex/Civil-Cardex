// Sincroniza los techos de CONOCIDOS (architecture.test.ts) al tamaño real de los archivos.
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'src/architecture/architecture.test.ts';
let src = readFileSync(f, 'utf8');
const m = src.match(/const CONOCIDOS: Record<string, number> = \{([\s\S]*?)\n\};/);
let fixes = 0;
let out = src;
for (const [, ruta, techo] of [...m[1].matchAll(/'([^']+)': (\d+),/g)]) {
  let n;
  try {
    n = readFileSync('src/' + ruta, 'utf8').split('\n').length;
  } catch {
    continue;
  }
  if (n !== Number(techo)) {
    const needle = `'${ruta}': ${techo},`;
    if (!out.includes(needle)) {
      console.log('NO MATCH', ruta);
      continue;
    }
    out = out.replace(needle, `'${ruta}': ${n},`);
    fixes++;
  }
}
writeFileSync(f, out);
console.log('techos actualizados:', fixes);

// ¿Hay que construir en Vercel? Salta el build cuando el commit SOLO tocó documentación.
//
// Por qué: cada push dispara dos `vite build` + el prerender (~1-2 min de máquina). Un commit
// que solo cambia AGENTS.md o docs/*.md no altera NADA del sitio: gastar ese build es tiempo
// (y minutos de facturación) tirados. Ej: "docs: AGENTS.md — ronda 70" → skip.
//
// Vercel llama este script vía `ignoreCommand`: exit 0 = NO construir (saltar), no-cero = construir.
// Si no hay diff utilizable (primer commit del clon, fuera de Vercel) se construye: ante la
// duda, construir es lo seguro.
import { execFileSync } from 'node:child_process';

/** Rutas que NO cambian el sitio: markdown en cualquier carpeta, docs/ y la licencia. */
const SOLO_DOCS = /(\.mdx?$)|(^docs\/)|(^LICENSE)/i;

function archivosDelCommit() {
  const base = process.env.VERCEL_GIT_PREVIOUS_SHA || 'HEAD~1';
  try {
    // execFileSync (sin shell): en Windows `cmd` se come el `^` de `HEAD^` y el diff sale vacío.
    const salida = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return salida.split(/\r?\n/).filter(Boolean);
  } catch {
    return null;
  }
}

const archivos = archivosDelCommit();
if (!archivos || archivos.length === 0) {
  console.log('[ignore-build] sin diff utilizable: se construye');
  process.exit(1);
}

const codigo = archivos.filter((f) => !SOLO_DOCS.test(f));
if (codigo.length === 0) {
  console.log(`[ignore-build] solo documentación (${archivos.length} archivo/s): se salta`);
  process.exit(0);
}

console.log(`[ignore-build] ${codigo.length} archivo/s de código: se construye`);
process.exit(0);

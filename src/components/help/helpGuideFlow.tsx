/**
 * Guía contextual del flujo de trabajo (fachada): recompone las claves 'cf:…' desde los 5
 * archivos de dominio (proyecto, visor, redes, informes, isometría). El hub helpGuide.tsx
 * sigue importando GUIA_FLOW de aquí — ningún consumidor cambia.
 * Ej: HelpPanel lee GUIA['cf:visor'], que llega por este spread desde helpGuideViewer.
 */
import type { GUIA_TYPE } from './helpGuideTypes.tsx';
import { GUIA_PROJECT } from './helpGuideProject.ts';
import { GUIA_VIEWER } from './helpGuideViewer.ts';
import { GUIA_NETWORKS } from './helpGuideNetworks.ts';
import { GUIA_REPORTS } from './helpGuideReports.ts';
import { GUIA_ISOMETRY } from './helpGuideIsometry.ts';

export const GUIA_FLOW: GUIA_TYPE = {
  ...GUIA_PROJECT,
  ...GUIA_VIEWER,
  ...GUIA_NETWORKS,
  ...GUIA_REPORTS,
  ...GUIA_ISOMETRY,
};

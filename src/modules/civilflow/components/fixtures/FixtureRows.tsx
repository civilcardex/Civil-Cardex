/**
 * Bloques JSX del panel de aparatos (FixturesPanel): la cabecera plegable, el aviso de red
 * que no cuantifica, las líneas "Asignado a" / "Selecciona…" y las secciones de accesorios.
 * Reciben todo por props y pintan EXACTAMENTE lo que el panel pintaba inline (mismos textos,
 * clases y estilos). Ej: <PanelHeader accent="#2563EB" totalStr="4.5" unidadLbl="UC" .../>
 * dibuja la fila punto + " Aparatos" + insignia de total + flecha de plegado.
 */
import { useMemo } from 'react';
import AccesoriosSection from './AccessoriesSection.tsx';
import { FixturesPanel_S1, FixturesPanel_S2, FixturesPanel_S3 } from './panelStyles.ts';
import {
  FIXTURES_CHEVRON,
  FIXTURES_CUERPO,
  FIXTURES_HEADER_DER,
  FIXTURES_HEADER_IZQ,
  FIXTURES_NOCUANTIFICA,
  FIXTURES_NOCUANTIFICA_TIT,
  FIXTURES_NOCUANTIFICA_TXT,
  FIXTURES_SIN_SEL,
  badgeStyle,
  dotStyle,
} from './panelStyles.ts';
import {
  AFAC_CODO_MERGE,
  GAS_CODO_MERGE,
  afAcCodoDecDe,
  gasCodoDecDe,
  itemsAccAfAc,
  itemsAccGas,
} from './useFixturePanelModel.ts';

/** Props de la cabecera plegable del panel. */
export interface PanelHeaderProps {
  open: boolean;
  onToggle: () => void;
  /** ¿Hay elemento seleccionado? Enciende el punto del color de la red. */
  isActive: boolean;
  /** Color de la red activa (NETS.col). */
  accent: string;
  headerLbl: string;
  totalStr: string;
  /** Unidad del conteo (UC o UD según la red). */
  unidadLbl: string;
}

/**
 * Cabecera plegable del panel: punto de color + título " Aparatos" + insignia del total +
 * flecha ▾/▸. Es un <button> completo (la misma estructura que vivía inline en el panel).
 */
export function PanelHeader({
  open,
  onToggle,
  isActive,
  accent,
  headerLbl,
  totalStr,
  unidadLbl,
}: PanelHeaderProps) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} style={FixturesPanel_S1}>
      <div style={FIXTURES_HEADER_IZQ}>
        <span style={dotStyle(isActive, accent)} />
        <span style={FixturesPanel_S2}>{headerLbl}</span>
      </div>
      <div style={FIXTURES_HEADER_DER}>
        <span style={badgeStyle(accent)}>
          {totalStr} {unidadLbl}
        </span>
        <span style={FIXTURES_CHEVRON}>{open ? '▾' : '▸'}</span>
      </div>
    </button>
  );
}

/**
 * Bloque plano para redes que no cuantifican aparatos (p. ej. rci/vent): título +
 * "Esta red no cuantifica aparatos sanitarios." El panel lo devuelve temprano.
 */
export function PanelNoCuantifica() {
  return (
    <div style={FIXTURES_NOCUANTIFICA}>
      <div style={FIXTURES_NOCUANTIFICA_TIT}>Cuantificación de aparatos</div>
      <div style={FIXTURES_NOCUANTIFICA_TXT}>Esta red no cuantifica aparatos sanitarios.</div>
    </div>
  );
}

/** Línea "Asignado a X" con el nombre del elemento en el color de la red. */
export function PanelAsignadoA({ targetLbl, accent }: { targetLbl: string; accent: string }) {
  return (
    <div style={FixturesPanel_S3}>
      <span>
        Asignado a <span style={{ color: accent, fontWeight: 700 }}>{targetLbl}</span>
      </span>
    </div>
  );
}

/** Mensaje de selección vacía, variado por contexto (área de sector / gas / resto). */
export function PanelSinSeleccion({
  rejillasArea,
  isGas,
}: {
  rejillasArea?: boolean;
  isGas: boolean;
}) {
  return (
    <div style={FIXTURES_SIN_SEL}>
      {rejillasArea
        ? 'Selecciona un área de sector en el dibujo'
        : isGas
          ? 'Selecciona un tramo de gas'
          : 'Selecciona un ramal/bajante en el dibujo'}
    </div>
  );
}

/** Cuerpo abierto del panel (padding uniforme alrededor de las filas). */
export function PanelCuerpo({ children }: { children: React.ReactNode }) {
  return <div style={FIXTURES_CUERPO}>{children}</div>;
}

/** Accesorios de AF/AC (curHidro) con el codo 90° medio fusionado en una sola fila. */
export function PanelAccesoriosAfAc({
  targetId,
  curHidro,
  incAcc,
  decAcc,
  accent,
}: {
  targetId: string | null;
  curHidro: { accesorios: Record<string, number> };
  incAcc: (accId: string) => void;
  decAcc: (accId: string) => void;
  accent: string;
}) {
  const items = useMemo(() => itemsAccAfAc(), []);
  const accCodoInc = (accId: string) => incAcc(accId === 'codo90rm' ? 'codo90rmSube' : accId);
  const accCodoDec = (accId: string) => afAcCodoDecDe(curHidro.accesorios || {}, accId, decAcc);
  return (
    <AccesoriosSection
      targetId={targetId}
      curHidro={curHidro}
      incAcc={accCodoInc}
      decAcc={accCodoDec}
      accent={accent}
      items={items}
      merge={AFAC_CODO_MERGE}
    />
  );
}

/** Accesorios de gas (GAS_ACC) con las familias sube/baja fusionadas en una sola fila. */
export function PanelAccesoriosGas({
  targetId,
  gasAccMap,
  incAccGas,
  decAccGas,
  accent,
}: {
  targetId: string | null;
  gasAccMap: Record<string, number>;
  incAccGas: (accId: string) => void;
  decAccGas: (accId: string) => void;
  accent: string;
}) {
  const items = useMemo(() => itemsAccGas(), []);
  const gasCodoDec = (accId: string) => gasCodoDecDe(gasAccMap, accId, decAccGas);
  return (
    <AccesoriosSection
      targetId={targetId}
      curHidro={{ accesorios: gasAccMap }}
      incAcc={incAccGas}
      decAcc={gasCodoDec}
      accent={accent}
      items={items}
      merge={GAS_CODO_MERGE}
    />
  );
}

import { describe, it, expect, beforeEach } from 'vitest';
import { clearLocalWorkspace } from '../workspaceReset.ts';
import { resetStorage, seedTrazos, trazosDe } from '../../../../test/storageHarness.ts';

// RESET DEL WORKSPACE: qué sobrevive al abrir/cambiar de proyecto.
//
// Causa raíz que fijan estos tests (orig. usuario 2026-10-28: "los elementos de la cubierta
// desaparecen al cerrar la pestaña y reabrir el proyecto"): abrir un proyecto borraba TODO el
// namespace `civilflow_*`, incluida la caché local de trazos de cada piso
// (`civilflow_trazos_<planoId>`). Si el guardado en la nube de ese piso había fallado (o la BD
// quedó con una copia vacía), la única copia del dibujo moría en la apertura.
//
// Solo se conservan los planos del proyecto que se ABRE: la propagación enumera TODAS las
// claves de trazos del navegador, así que una copia de otro proyecto se colaría en los conteos
// (misma familia que el piso fantasma `_bak`). El logout y el borrado de proyecto no pasan
// planos: borran todo (equipo compartido / datos borrados a propósito).

const lsGet = (k: string) => localStorage.getItem(k);

describe('clearLocalWorkspace', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('sin planosVigentes (logout / borrado de proyecto) borra también los trazos', () => {
    seedTrazos('101', { ts: Date.now(), ramales: [{ id: 'R1' }] });
    localStorage.setItem('civilflow_civilflow_proy', JSON.stringify({ nombre: 'A' }));

    clearLocalWorkspace();

    expect(lsGet('civilflow_trazos_101')).toBeNull();
    expect(lsGet('civilflow_civilflow_proy')).toBeNull();
  });

  it('al abrir proyecto conserva los trazos de SUS planos y limpia el resto', () => {
    seedTrazos('101', { ts: Date.now(), ramales: [{ id: 'RALL1', net: 'll' }] });
    seedTrazos('202', { ts: Date.now(), ramales: [{ id: 'AJENO', net: 'll' }] });
    localStorage.setItem('civilflow_civilflow_proy', JSON.stringify({ nombre: 'A' }));
    localStorage.setItem('civilflow_plans_meta', JSON.stringify([{ id: 101 }]));
    localStorage.setItem('civilflow_net_af', '#00dce5'); // preferencia del dispositivo
    localStorage.setItem('civilflow_pdf_hidden_nets', JSON.stringify(['gas']));

    clearLocalWorkspace({ planosVigentes: [101] });

    // El dibujo del piso del proyecto abierto sobrevive: es el respaldo de un guardado fallido.
    expect(trazosDe('101').ramales).toEqual([{ id: 'RALL1', net: 'll' }]);
    // El de OTRO proyecto no puede quedarse (la propagación enumera todas las claves).
    expect(lsGet('civilflow_trazos_202')).toBeNull();
    // El resto del workspace NO (evita que el proyecto anterior se mezcle con el entrante).
    expect(lsGet('civilflow_civilflow_proy')).toBeNull();
    expect(lsGet('civilflow_plans_meta')).toBeNull();
    expect(lsGet('civilflow_active_proyecto_id')).toBeNull();
    // Las preferencias del navegador siguen intactas.
    expect(lsGet('civilflow_net_af')).toBe('#00dce5');
    expect(lsGet('civilflow_pdf_hidden_nets')).toBe(JSON.stringify(['gas']));
  });

  it('un proyecto nuevo (lista vacía) no conserva trazos de nadie', () => {
    seedTrazos('101', { ts: Date.now(), ramales: [{ id: 'R1' }] });

    clearLocalWorkspace({ planosVigentes: [] });

    expect(lsGet('civilflow_trazos_101')).toBeNull();
  });

  it('un doc ilegible se conserva: puede ser el único respaldo del piso', () => {
    localStorage.setItem('civilflow_trazos_roto', '{esto no es json');

    clearLocalWorkspace({ planosVigentes: ['roto'] });

    expect(lsGet('civilflow_trazos_roto')).toBe('{esto no es json');
  });
});

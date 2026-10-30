import { describe, it, expect } from 'vitest';
import { readCmSnapshot, type CmGetDataDto } from '../dto.ts';

// readCmSnapshot es el lector PASSTHROUGH de la frontera BD→UI: lo que llega del RPC
// (Remote Procedure Call, función que vive en la BD y se llama por red) cm_get_data
// se devuelve tal cual, sin defaults. El payload de abajo replica la forma EXACTA que
// arma el SQL (20260814000001_cm_schema.sql): 10 claves, integrantes anidado dentro de
// cada cuadrilla y config como wrapper {config, config_listas, categorias_apu, updated_at}
// (la fila de cm_config sin user_id). APU (Análisis de Precios Unitarios).
function payloadCompleto(): CmGetDataDto {
  return {
    proyectos: [
      {
        id: 'p1',
        user_id: 'u1',
        codigo: 'CM-1',
        nombre: 'Torre norte',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      },
    ],
    factores: [
      {
        id: 'f1',
        codigo: 'FP-1',
        nombre: 'Prestaciones sociales',
        factor: 0.52,
        tipo: 'prestaciones',
      },
    ],
    cargos: [{ id: 'c1', codigo: 'C-1', descripcion: 'Ayudante', num_salarios_base: 1 }],
    cuadrillas: [
      {
        id: 'q1',
        codigo: 'Q-1',
        descripcion: 'Cuadrilla de mampostería',
        integrantes: [{ id: 'it1', cargo_id: 'c1', cantidad: 2 }],
      },
    ],
    equipos: [
      {
        id: 'e1',
        codigo: 'EQ-1',
        nombre: 'Andamio',
        tipo: 'Equipo menor',
        unidad: 'HR',
        costo_hora: 6000,
        fecha_cotizacion: '2026-01-01',
        proveedor_id: 'pr1',
      },
    ],
    insumos: [
      {
        id: 'i1',
        codigo: 'IN-1',
        nombre: 'Cemento',
        unidad: 'KG',
        origen: 'Local',
        categoria: 'Materiales',
        subcategoria: 'Aglomerantes',
        marca_referencia: 'Nacional',
        costo_unitario: 100,
        fecha_cotizacion: '2026-01-01',
        apu_basico_id: '',
        proveedor_id: 'pr1',
      },
    ],
    proveedores: [
      {
        id: 'pr1',
        codigo: 'PR-1',
        nombre: 'Ferretería central',
        nit: '900123456',
        contacto: 'Luis',
        tel1: '6010000',
        tel2: '',
        email: 'ventas@fc.com',
        direccion: 'Calle 1',
        ciudad: 'Bogotá',
        departamento: 'Cundinamarca',
        tipo: ['Materiales'],
        notas: '',
        activo: true,
      },
    ],
    apus: [
      {
        id: 'a1',
        codigo: 'APU-1',
        nombre: 'Muro en ladrillo',
        categoria: 'Mampostería',
        unidad: 'M2',
        fecha_creacion: '2026-01-01',
        es_basico: false,
        recursos_mo: [],
        recursos_eq: [],
        recursos_ins: [],
        recursos_transporte: [],
      },
    ],
    presupuestos: [
      {
        id: 'pp1',
        codigo: 'PP-1',
        nombre: 'Presupuesto obra',
        entidad: 'Entidad',
        contrato: '123',
        objeto: 'Obra',
        plazo: '2 meses',
        fecha_creacion: '2026-01-01',
        ciudad: 'Bogotá',
        departamento: 'Cundinamarca',
        elaborado_por: 'Ing. Ana',
        activo: true,
        con_sub_proyectos: false,
        parent_id: null,
        estado: 'borrador',
        fecha_cierre: '',
        observaciones: '',
        items: [],
        aiu_override: { activo: false, pct_a: 10, pct_i: 3, pct_u: 6, iva_pct: 19 },
        factores_snap: [],
        cargos_snap: [],
        apus_snap: [],
        insumos_snap: [],
        equipos_snap: [],
        cuadrillas_snap: [],
        perfil_pais_snap: null,
        formulario_original: null,
      },
    ],
    config: {
      config: {
        pais: 'CO',
        moneda: 'USD',
        salario_base: 400,
        auxilio_transporte: 0,
        ibc_tope: 25,
        pct_administracion: 10,
        pct_imprevistos: 3,
        pct_utilidad: 6,
        herr_pct: 5,
        dias_mes: 25,
        horas_mes: 182,
        unidad: 'mes',
        vr_resumido: false,
        usar_en_cada_apu: true,
        usar_fp_en_apu: false,
        comentarios_apu: {
          tipo_salario: '',
          factor_prest: '',
          costo_personal_fp: '',
          herramienta_menor: '',
          administracion: '',
          imprevistos: '',
          utilidad: '',
          vr_resumido: '',
          usar_en_cada_apu: '',
        },
      },
      config_listas: {
        unidades: [{ abreviatura: 'M2', descripcion: 'Metro cuadrado', tipo: 'Área' }],
        categorias_insumo: [{ codigo: 'MAT', desc: 'Materiales' }],
        categorias_apu: [{ codigo: 'MAMP', desc: 'Mampostería' }],
        tipos_equipo: [],
        origenes: [],
        unidades_transporte: [],
        perfiles_pais: [],
        tipos_unidad: [],
        mapeos_formulario: [],
      },
      categorias_apu: [{ codigo: 'MAMP', desc: 'Mampostería' }],
      updated_at: '2026-01-02T00:00:00Z',
    },
  };
}

describe('readCmSnapshot (frontera BD→UI de cm_get_data)', () => {
  it('payload completo: las 10 claves con los MISMOS valores, passthrough por referencia', () => {
    const payload = payloadCompleto();
    const snap = readCmSnapshot(payload);
    expect(Object.keys(snap).sort()).toEqual([
      'apus',
      'cargos',
      'config',
      'cuadrillas',
      'equipos',
      'factores',
      'insumos',
      'presupuestos',
      'proveedores',
      'proyectos',
    ]);
    expect(snap).toEqual(payload);
    // Passthrough: las filas viajan por REFERENCIA — sin clonar ni transformar nada.
    expect(snap.factores).toBe(payload.factores);
    expect(snap.cuadrillas?.[0]?.integrantes).toBe(payload.cuadrillas?.[0]?.integrantes);
    expect(snap.config?.config).toBe(payload.config?.config);
  });

  it('wrapper config: las 3 piezas internas (config, config_listas, categorias_apu) intactas', () => {
    const snap = readCmSnapshot(payloadCompleto());
    expect(snap.config?.config?.pais).toBe('CO');
    expect(snap.config?.config_listas?.unidades).toHaveLength(1);
    expect(snap.config?.categorias_apu?.[0]?.codigo).toBe('MAMP');
  });

  it('clave faltante (sin proveedores): queda undefined, SIN defaults añadidos', () => {
    const { proveedores: _sin, ...resto } = payloadCompleto();
    const snap = readCmSnapshot(resto);
    expect('proveedores' in snap).toBe(false);
    expect(snap.proveedores).toBeUndefined();
    expect(Object.keys(snap)).toHaveLength(9);
    // Cero relleno: ni [] ni {} inventados por el lector — el resto vuelve exacto.
    expect(snap).toEqual(resto);
  });

  it('claves extra del jsonb sobreviven: el lector no filtra ni recorta', () => {
    const payload = { ...payloadCompleto(), columna_nueva_en_bd: 7 };
    const snap = readCmSnapshot(payload);
    expect(snap).toEqual(payload);
  });

  it('no-objeto (null/undefined/array/string/número): {} documentado — nada inventado', () => {
    expect(readCmSnapshot(null)).toEqual({});
    expect(readCmSnapshot(undefined)).toEqual({});
    expect(readCmSnapshot([1, 2])).toEqual({});
    expect(readCmSnapshot('{"cargos":[]}')).toEqual({});
    expect(readCmSnapshot(42)).toEqual({});
    // El resultado vacío NO trae claves rellenas: downstream (migrateState) pone sus defaults.
    expect(Object.keys(readCmSnapshot(null))).toHaveLength(0);
  });
});

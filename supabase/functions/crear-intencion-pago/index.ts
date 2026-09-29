// Crea la intención de pago (fila pendiente en app_pagos) y devuelve los datos
// que el widget de Wompi necesita: referencia, monto y firma de integridad.
// El monto SIEMPRE se calcula en el servidor con el catálogo local.
import {
  CATALOGO,
  DESCUENTO_PAQUETE,
  calcularTotalCentavos,
  permitirPeticion,
  firmaIntegridad,
  json,
  preflight,
  supabaseAdmin,
  suscripcionesHabilitadas,
  usuarioDelRequest,
  type ModuloId,
  type Periodo,
} from '../_shared/wompi.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const admin = supabaseAdmin();
  const uid = await usuarioDelRequest(admin, req);
  if (!uid) return json(401, { error: 'no_autenticado' });
  if (!(await suscripcionesHabilitadas(admin))) {
    return json(403, { error: 'suscripciones_deshabilitadas' });
  }

  // Rate-limit in-memory (deuda #3): 5 creaciones/min por usuario es de sobra para un
  // humano con modal; el abuso serio lo corta la cota en BD de abajo.
  if (!permitirPeticion('intencion', uid, 5)) {
    return json(429, { error: 'demasiadas_peticiones' });
  }

  // Cota dura GLOBAL en BD (no se diluye entre instancias): >20 intents pendientes/hora.
  const { count: intents } = await admin
    .from('app_pagos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('estado', 'pendiente')
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  if ((intents ?? 0) > 20) {
    return json(429, { error: 'demasiadas_intenciones' });
  }

  let body: { modulos?: unknown; periodo?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'json_invalido' });
  }

  // FUENTE ÚNICA de precios (deuda #4): app_precios en BD. Fallback al literal solo si la
  // tabla está vacía (bootstrap). Cambiar precio = UPDATE en SQL Editor, sin deploy.
  const { data: preciosBd } = await admin.from('app_precios').select('*');
  const catalogo: Record<string, { precioMensualCentavos: number; precioAnualCentavos: number }> =
    {};
  for (const row of preciosBd ?? []) {
    catalogo[row.modulo] = {
      precioMensualCentavos: Number(row.precio_mensual_centavos),
      precioAnualCentavos: Number(row.precio_anual_centavos),
    };
  }
  const precioDe = (m: string, per: Periodo): number | null => {
    const p = catalogo[m];
    if (p) return per === 'anual' ? p.precioAnualCentavos : p.precioMensualCentavos;
    return m in CATALOGO
      ? per === 'anual'
        ? CATALOGO[m as ModuloId].precioAnualCentavos
        : CATALOGO[m as ModuloId].precioMensualCentavos
      : null;
  };

  const periodo: Periodo | null =
    body.periodo === 'mensual' || body.periodo === 'anual' ? body.periodo : null;
  const modulos =
    Array.isArray(body.modulos) && periodo
      ? ([
          ...new Set(
            (body.modulos as unknown[]).filter(
              (m) => typeof m === 'string' && precioDe(m as string, periodo) != null,
            ) as string[],
          ),
        ] as ModuloId[])
      : [];
  if (modulos.length === 0 || !periodo) {
    return json(400, { error: 'parametros_invalidos' });
  }

  // Reúso de intención pendiente <24 h con la MISMA selección: cada apertura del modal
  // creaba una fila nueva (spam) y las viejas congelaban el precio para siempre.
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: pendiente } = await admin
    .from('app_pagos')
    .select('referencia, monto_centavos, modulos, periodo')
    .eq('user_id', uid)
    .eq('estado', 'pendiente')
    .eq('periodo', periodo)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(10);
  const montoDe = modulos.reduce((acc, m) => acc + (precioDe(m, periodo) ?? 0), 0);
  const montoCentavos = Math.round(
    modulos.length >= 2 ? montoDe * (1 - DESCUENTO_PAQUETE) : montoDe,
  );
  const mismaSeleccion = (pendiente ?? []).find(
    (row) =>
      row.monto_centavos === montoCentavos &&
      JSON.stringify([...(row.modulos as string[])].sort()) === JSON.stringify([...modulos].sort()),
  );

  // Referencia UNA sola vez (reutilizada o nueva) y firma ANTES del insert: si falta
  // WOMPI_INTEGRIDAD no dejamos filas huérfanas, y la firma siempre corresponde a la
  // referencia devuelta.
  const referencia = mismaSeleccion?.referencia ?? `CC-${uid.slice(0, 8)}-${Date.now()}`;
  let firma: string;
  try {
    firma = await firmaIntegridad(referencia, montoCentavos, 'COP');
  } catch {
    return json(503, { error: 'wompi_no_configurado' });
  }

  if (!mismaSeleccion) {
    const { error } = await admin.from('app_pagos').insert({
      referencia,
      user_id: uid,
      modulos,
      periodo,
      monto_centavos: montoCentavos,
      moneda: 'COP',
      estado: 'pendiente',
    });
    if (error) return json(500, { error: 'no_se_pudo_registrar_intencion' });
  }

  return json(200, {
    referencia,
    montoCentavos,
    firmaIntegridad: firma,
    publicKey: Deno.env.get('WOMPI_PUBLICO') ?? null,
  });
});

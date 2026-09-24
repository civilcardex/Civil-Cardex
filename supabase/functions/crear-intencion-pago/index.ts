// Crea la intención de pago (fila pendiente en cf_pagos) y devuelve los datos
// que el widget de Wompi necesita: referencia, monto y firma de integridad.
// El monto SIEMPRE se calcula en el servidor con el catálogo local.
import {
  CATALOGO,
  calcularTotalCentavos,
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

  let body: { modulos?: unknown; periodo?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'json_invalido' });
  }

  const modulos = Array.isArray(body.modulos)
    ? [...new Set(body.modulos.filter((m): m is ModuloId => m in CATALOGO))]
    : [];
  const periodo: Periodo | null =
    body.periodo === 'mensual' || body.periodo === 'anual' ? body.periodo : null;
  if (modulos.length === 0 || !periodo) {
    return json(400, { error: 'parametros_invalidos' });
  }

  const montoCentavos = calcularTotalCentavos(modulos, periodo);
  const referencia = `CC-${uid.slice(0, 8)}-${Date.now()}`;

  const { error } = await admin.from('cf_pagos').insert({
    referencia,
    user_id: uid,
    modulos,
    periodo,
    monto_centavos: montoCentavos,
    moneda: 'COP',
    estado: 'pendiente',
  });
  if (error) return json(500, { error: 'no_se_pudo_registrar_intencion' });

  let firma: string;
  try {
    firma = await firmaIntegridad(referencia, montoCentavos, 'COP');
  } catch {
    return json(503, { error: 'wompi_no_configurado' });
  }

  return json(200, {
    referencia,
    montoCentavos,
    firmaIntegridad: firma,
    publicKey: Deno.env.get('WOMPI_PUBLICO') ?? null,
  });
});

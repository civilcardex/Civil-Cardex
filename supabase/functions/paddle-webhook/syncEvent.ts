import type { clienteAdmin } from '../_shared/payment_utils.ts';
import { entornoPaddle, EventName, type EventEntity } from '../_shared/paddleSdk.ts';

/** Guarda el estado de facturación en orden de ocurrencia. Ej: un evento viejo de alta no revierte una baja. */
export async function sincronizarEvento(
  event: EventEntity,
  admin: ReturnType<typeof clienteAdmin>,
) {
  switch (event.eventType) {
    case EventName.CustomerCreated:
    case EventName.CustomerUpdated: {
      const { error } = await admin.rpc('sincronizar_paddle_cliente', {
        p_entorno: entornoPaddle,
        p_customer_id: event.data.id,
        p_email: event.data.email,
        p_evento_en: event.occurredAt,
      });
      if (error) throw new Error('sincronizar_cliente');
      return;
    }
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionCanceled:
    case EventName.SubscriptionActivated:
    case EventName.SubscriptionPaused:
    case EventName.SubscriptionPastDue:
    case EventName.SubscriptionResumed:
    case EventName.SubscriptionTrialing: {
      const { data } = event;
      const { error } = await admin.rpc('sincronizar_paddle_suscripcion', {
        p_entorno: entornoPaddle,
        p_subscription_id: data.id,
        p_customer_id: data.customerId,
        p_estado: data.status,
        p_articulos: data.items.map((item) => ({
          price_id: item.price?.id ?? null,
          product_id: item.product?.id ?? item.price?.productId ?? null,
          estado: item.status,
          cantidad: item.quantity,
        })),
        p_cambio_programado: data.scheduledChange?.action ?? null,
        p_cambio_en: data.scheduledChange?.effectiveAt ?? null,
        p_evento_en: event.occurredAt,
      });
      if (error) throw new Error('sincronizar_suscripcion');
    }
  }
}

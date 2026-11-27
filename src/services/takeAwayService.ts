import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.ts';
import { Order } from '../types/index.ts';

export const TAKE_AWAY_RETIRE_NOTES = [
  'En 15 min',
  'En 30 min',
  'Lo antes posible',
] as const;

export function generateDeliveryCode4Digits(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function getNextTakeAwayCorrelative(orders: Order[]): string {
  let maxNumber = 0;
  orders.forEach((o) => {
    if (o.tipoPedido === 'llevar' && o.codigoCorrelativo) {
      const match = o.codigoCorrelativo.match(/#LL-(\d+)/i);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > maxNumber) {
          maxNumber = parsed;
        }
      }
    }
  });
  const next = maxNumber + 1;
  return `#LL-${String(next).padStart(2, '0')}`;
}

export function formatSpacedCode(code: string): string {
  const clean = (code || '').replace(/\D/g, '').slice(0, 4).padStart(4, '0');
  return clean.split('').join(' ');
}

export function formatTakeAwayThermalTicket(params: {
  order: Order;
  discountBs?: number;
  cashGivenBs?: number;
}): string {
  const { order, discountBs = 0, cashGivenBs } = params;
  const correlative = order.codigoCorrelativo || '#LL-01';
  const spacedCode = formatSpacedCode(order.codigoEntrega || '0000');
  const fechaStr = new Date().toLocaleString('es-BO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const finalTotal = Math.max(0, Number((order.total - discountBs).toFixed(2)));
  const itemsText = order.items
    .map((i) => `- ${i.qty}x ${i.nombre}  Bs. ${(i.precioBs * i.qty).toFixed(2)}`)
    .join('\n');

  const paymentStatusLine = order.pagado
    ? `PAGADO (${order.paymentMethod || 'EFECTIVO'})`
    : 'PENDIENTE DE COBRO EN CAJA';

  const changeLine =
    order.pagado &&
    order.paymentMethod === 'EFECTIVO' &&
    typeof cashGivenBs === 'number' &&
    cashGivenBs >= finalTotal
      ? `Efectivo: Bs. ${cashGivenBs.toFixed(2)}\nCambio:   Bs. ${(cashGivenBs - finalTotal).toFixed(2)}\n`
      : '';

  return [
    '==========================================',
    '          EL CHURO MOSITO - TARIJA        ',
    '==========================================',
    `       *** PARA LLEVAR - ${correlative} ***`,
    `     CÓDIGO DE ENTREGA: [ ${spacedCode} ]`,
    '==========================================',
    `Cliente: ${order.clienteNombre || 'Cliente Mostrador'}`,
    order.clienteTelefono ? `WhatsApp: +591 ${order.clienteTelefono}` : null,
    `Retiro:  ${order.notaRetiro || 'En 15 min'}`,
    `Fecha:   ${fechaStr}`,
    `Pago:    ${paymentStatusLine}`,
    '------------------------------------------',
    'DETALLE DEL PEDIDO:',
    itemsText,
    '------------------------------------------',
    discountBs > 0 ? `Descuento: -Bs. ${discountBs.toFixed(2)}` : null,
    `TOTAL:     Bs. ${finalTotal.toFixed(2)}`,
    changeLine ? changeLine.trimEnd() : null,
    '------------------------------------------',
    '  Presenta tu CÓDIGO DE 4 DÍGITOS al',
    '  retirar tu pedido en mostrador.',
    '     ¡Gracias por tu preferencia!',
    '==========================================',
  ]
    .filter(Boolean)
    .join('\n')
    .replace(/\uFFFD/g, '');
}

export async function enqueueTakeAwayThermalPrint(params: {
  order: Order;
  discountBs?: number;
  cashGivenBs?: number;
}): Promise<string> {
  const { order, discountBs = 0, cashGivenBs } = params;
  const textoRecibo = formatTakeAwayThermalTicket({ order, discountBs, cashGivenBs });
  const finalTotal = Math.max(0, Number((order.total - discountBs).toFixed(2)));

  await addDoc(collection(db, 'print_queue'), {
    mesa: 0,
    tableName: `PARA LLEVAR ${order.codigoCorrelativo || '#LL-01'}`,
    tipoPedido: 'llevar',
    codigoCorrelativo: order.codigoCorrelativo || '#LL-01',
    codigoEntrega: order.codigoEntrega || '0000',
    clienteNombre: order.clienteNombre || 'Cliente Mostrador',
    notaRetiro: order.notaRetiro || 'En 15 min',
    textoRecibo,
    total: finalTotal,
    descuento: discountBs,
    fecha: serverTimestamp(),
    status: 'pending',
  });

  return textoRecibo;
}

export function buildTakeAwayWhatsAppReadyUrl(order: Order): string | null {
  const cleanPhone = (order.clienteTelefono || '').replace(/\D/g, '').slice(0, 8);
  if (!/^[67]\d{7}$/.test(cleanPhone)) return null;

  const correlative = order.codigoCorrelativo || '#LL-01';
  const code = order.codigoEntrega || '0000';
  const nombre = order.clienteNombre || 'Estimado cliente';

  const message =
    `*EL CHURO MOSITO* 🔥\n` +
    `¡Hola *${nombre}*! Tu pedido Para Llevar *${correlative}* ya está *LISTO PARA RETIRAR* en nuestro local.\n\n` +
    `🔐 *Código de entrega:* *${code}*\n` +
    `💰 *Total:* Bs. ${order.total.toFixed(2)} (${order.pagado ? 'Pagado' : 'Por pagar en mostrador'})\n\n` +
    `Por favor muestra este código de 4 dígitos en mostrador al retirar. ¡Te esperamos!`;

  return `https://wa.me/591${cleanPhone}?text=${encodeURIComponent(message.replace(/\uFFFD/g, ''))}`;
}

export function buildTakeAwayReceiptWhatsAppUrl(params: {
  order: Order;
  phone?: string;
  discountBs?: number;
}): string | null {
  const { order, phone, discountBs = 0 } = params;
  const cleanPhone = (phone || order.clienteTelefono || '').replace(/\D/g, '').slice(0, 8);
  if (!/^[67]\d{7}$/.test(cleanPhone)) return null;

  const finalTotal = Math.max(0, Number((order.total - discountBs).toFixed(2)));
  const itemsListText = order.items
    .map((i) => `- ${i.qty}x ${i.nombre} - Bs. ${(i.precioBs * i.qty).toFixed(2)}`)
    .join('\n');

  const rawMsg =
    `*EL CHURO MOSITO*\n` +
    `🛍️ Comprobante Para Llevar *${order.codigoCorrelativo || '#LL-01'}*\n` +
    `🔐 *Código de Entrega:* *${order.codigoEntrega || '0000'}*\n` +
    `----------------------------------\n` +
    `*Cliente:* ${order.clienteNombre || 'Cliente'}\n` +
    `*Retiro:* ${order.notaRetiro || 'En 15 min'}\n` +
    `*Pago:* ${order.pagado ? `PAGADO (${order.paymentMethod || 'EFECTIVO'})` : 'Pendiente en mostrador'}\n` +
    `----------------------------------\n` +
    `*Detalle:*\n${itemsListText}\n` +
    `----------------------------------\n` +
    (discountBs > 0 ? `*Descuento:* -Bs. ${discountBs.toFixed(2)}\n` : '') +
    `*Total:* Bs. ${finalTotal.toFixed(2)}\n\n` +
    `Muestra tu código de 4 dígitos al retirar en mostrador. ¡Gracias por tu preferencia!`;

  return `https://wa.me/591${cleanPhone}?text=${encodeURIComponent(rawMsg.replace(/\uFFFD/g, ''))}`;
}

export function buildTakeAwayClientShareWhatsAppUrl(order: Order): string {
  const itemsText = order.items
    .map((i) => `- ${i.qty}x ${i.nombre} (Bs. ${(i.precioBs * i.qty).toFixed(2)})`)
    .join('\n');

  const rawMsg =
    `*EL CHURO MOSITO* - Pedido Para Llevar *${order.codigoCorrelativo || '#LL-01'}*\n` +
    `🔐 *Código de retiro:* ${order.codigoEntrega || '0000'}\n` +
    `👤 *A nombre de:* ${order.clienteNombre || 'Cliente'}\n` +
    `⏱️ *Retiro:* ${order.notaRetiro || 'En 15 min'}\n\n` +
    `*Detalle:*\n${itemsText}\n\n` +
    `💰 *Total:* Bs. ${order.total.toFixed(2)}`;

  return `https://wa.me/?text=${encodeURIComponent(rawMsg.replace(/\uFFFD/g, ''))}`;
}

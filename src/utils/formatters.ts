import { Order } from '../types/index.ts';

export function formatCurrencyBs(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `Bs. ${safe.toFixed(2)}`;
}

export function calculateItemsTotal(items: ReadonlyArray<{ precioBs: number; qty: number }>): number {
  const sum = items.reduce((acc, item) => acc + item.precioBs * item.qty, 0);
  return Number(sum.toFixed(2));
}

export function countItemsQty(items: ReadonlyArray<{ qty: number }>): number {
  return items.reduce((acc, item) => acc + item.qty, 0);
}

export function sanitizeBoliviaPhone(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(0, 8);
}

export function isValidBoliviaPhone(phone: string): boolean {
  return /^[67]\d{7}$/.test(sanitizeBoliviaPhone(phone));
}

export function isOrderOpen(order: Pick<Order, 'status'>): boolean {
  return order.status !== 'pagado' && order.status !== 'cancelado';
}

export function isTakeAwayOrder(order: Pick<Order, 'tipoPedido'>): boolean {
  return order.tipoPedido === 'llevar';
}

import type { Customer, Order, Payment, PaymentStatus, Purchase } from "@/types/crm";

/** Outstanding balance on a purchase. */
export function purchaseBalance(purchase: Purchase): number {
  return Math.max(0, (purchase.price || 0) - (purchase.advancePaid || 0));
}

/** Total outstanding across all of a customer's purchases. */
export function customerBalance(customer: Customer): number {
  return (customer.purchases ?? []).reduce((sum, purchase) => sum + purchaseBalance(purchase), 0);
}

/** Payment status implied by a purchase's price vs. advance. */
export function purchasePaymentStatus(purchase: Purchase): PaymentStatus {
  if ((purchase.price || 0) > 0 && purchaseBalance(purchase) <= 0) return "Paid";
  if ((purchase.advancePaid || 0) > 0) return "Partial";
  return "Pending";
}

/** Human label for the purchased product. */
export function purchaseLabel(purchase: Purchase): string {
  return [purchase.productBrand, purchase.productModel].filter(Boolean).join(" ") || purchase.productType || "Product";
}

/**
 * Upsert one Order per customer purchase so a customer's payment details always
 * show in Orders, and edits stay in step. An existing purchase-linked order keeps
 * its number, order status and quotation link; the money/payment fields are
 * refreshed from the purchase. Manually created orders are left untouched.
 */
export function syncOrdersFromCustomer(customer: Customer, orders: Order[]): Order[] {
  const purchases = customer.purchases ?? [];
  const validPurchaseIds = new Set(purchases.map((p) => p.purchaseId));
  // Drop this customer's purchase-linked orders whose purchase was removed; leave
  // manually created orders (no purchaseId) and other customers' orders alone.
  const result = orders.filter(
    (order) => !(order.customerId === customer.customerId && order.purchaseId && !validPurchaseIds.has(order.purchaseId))
  );
  if (purchases.length === 0) return result;

  let maxSeq = result.reduce((max, order) => {
    const match = /(\d+)\s*$/.exec(order.orderNumber);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  purchases.forEach((purchase) => {
    const existing = result.find((order) => order.purchaseId === purchase.purchaseId);
    const next: Order = {
      orderId: existing?.orderId ?? `ORD-P-${purchase.purchaseId}`,
      orderNumber: existing?.orderNumber ?? `RC-ORD-2026-${String(++maxSeq).padStart(3, "0")}`,
      quotationId: existing?.quotationId ?? "",
      customerId: customer.customerId,
      deliveryDate: purchase.dueDate || existing?.deliveryDate || "",
      paymentStatus: purchasePaymentStatus(purchase),
      status: existing?.status ?? "Processing",
      purchaseId: purchase.purchaseId,
      productLabel: purchaseLabel(purchase),
      amount: purchase.price || 0,
      advancePaid: purchase.advancePaid || 0,
      paymentMode: purchase.paymentMode,
      createdAt: existing?.createdAt ?? purchase.createdAt
    };
    if (existing) result[result.indexOf(existing)] = next;
    else result.unshift(next);
  });
  return result;
}

/** Stable payment id for a purchase-linked payment. */
export function purchasePaymentId(purchaseId: string): string {
  return `PAY-P-${purchaseId}`;
}

/**
 * Upsert one Payment per customer purchase so a payment recorded on the customer
 * also shows in the Payments module (and edits made there flow back — see the
 * Payments handler). Manually created payments (no purchaseId) are left untouched.
 */
export function syncPaymentsFromCustomer(customer: Customer, payments: Payment[]): Payment[] {
  const purchases = customer.purchases ?? [];
  const validIds = new Set(purchases.map((p) => purchasePaymentId(p.purchaseId)));
  // Remove this customer's purchase-linked payments whose purchase was removed.
  const result = payments.filter(
    (pay) => !(pay.customerId === customer.customerId && pay.purchaseId && !validIds.has(pay.paymentId))
  );
  purchases.forEach((purchase) => {
    const paymentId = purchasePaymentId(purchase.purchaseId);
    const existing = result.find((pay) => pay.paymentId === paymentId);
    const invoiceAmount = purchase.price || 0;
    const paidAmount = Math.min(invoiceAmount, purchase.advancePaid || 0);
    const next: Payment = {
      paymentId,
      customerId: customer.customerId,
      invoiceNumber: existing?.invoiceNumber || purchaseLabel(purchase),
      invoiceAmount,
      paidAmount,
      balanceAmount: Math.max(0, invoiceAmount - paidAmount),
      dueDate: purchase.dueDate || existing?.dueDate || "",
      status: purchasePaymentStatus(purchase),
      purchaseId: purchase.purchaseId,
      productLabel: purchaseLabel(purchase),
      paymentMode: purchase.paymentMode,
      createdAt: existing?.createdAt ?? purchase.createdAt
    };
    if (existing) result[result.indexOf(existing)] = next;
    else result.unshift(next);
  });
  return result;
}

export interface OrderProductItemDetail {
  name: string;
  variation?: string;
  sku?: string;
  quantity: number;
  unit: string;
}

export interface OrderProductSummary {
  totalQuantity: number;
  distinctItemCount: number;
  mainText: string;     // e.g. "4 thùng", "4 cái", "2 thùng, 3 hộp"
  subText: string;      // e.g. "2 loại SP" or variation name
  tooltipText: string;  // Detailed string for tooltip/title
  items: OrderProductItemDetail[];
}

export function getOrderProductSummary(orderItems?: any[]): OrderProductSummary {
  if (!orderItems || orderItems.length === 0) {
    return {
      totalQuantity: 0,
      distinctItemCount: 0,
      mainText: '0 SP',
      subText: '',
      tooltipText: 'Không có sản phẩm',
      items: [],
    };
  }

  const items: OrderProductItemDetail[] = orderItems.map((it) => {
    const qty = it.quantity ?? it.rawQuantity ?? 1;
    const unit = it.variant?.unit || it.unit || 'cái';
    const name = it.productName || it.variant?.product?.name || it.variant?.name || 'Sản phẩm';
    const variation = it.variationName || (it.variant?.name !== name ? it.variant?.name : '') || '';
    const sku = it.variant?.sku || it.externalSku || '';
    return { name, variation, sku, quantity: qty, unit };
  });

  const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);

  // Group quantities by unit
  const unitTotals: Record<string, number> = {};
  items.forEach((it) => {
    unitTotals[it.unit] = (unitTotals[it.unit] || 0) + it.quantity;
  });

  const unitEntries = Object.entries(unitTotals);
  let mainText = '';

  if (unitEntries.length === 1) {
    const [unit, qty] = unitEntries[0];
    mainText = `${qty} ${unit}`;
  } else {
    // Mixed units: e.g. "2 thùng, 3 hộp"
    mainText = unitEntries.map(([unit, qty]) => `${qty} ${unit}`).join(', ');
  }

  const subText = items.length > 1 ? `${items.length} loại SP` : items[0]?.variation || '';

  const tooltipLines = items.map((it) => {
    const varText = it.variation ? ` (${it.variation})` : '';
    const skuText = it.sku ? ` [${it.sku}]` : '';
    return `• ${it.name}${varText}${skuText}: ${it.quantity} ${it.unit}`;
  });
  if (items.length > 1) {
    tooltipLines.push(`---`);
    tooltipLines.push(`Tổng cộng: ${mainText} (${items.length} loại SP)`);
  }
  const tooltipText = tooltipLines.join('\n');

  return {
    totalQuantity,
    distinctItemCount: items.length,
    mainText,
    subText,
    tooltipText,
    items,
  };
}

import { useState } from 'react';

/**
 * Keeps items in the order they first appeared, for rendering. Moving an
 * <iframe> in the DOM makes the browser reload it, so preview cards are never
 * reordered in the DOM: their visual order comes from CSS `order` instead.
 * New ids are appended; removed ids drop out.
 */
export function useStableDomOrder(ids: string[]): string[] {
  const [order, setOrder] = useState(ids);
  const next = [...order.filter((id) => ids.includes(id)), ...ids.filter((id) => !order.includes(id))];
  // Adjusting state while rendering (React's pattern for derived state) avoids an extra effect pass.
  if (next.length !== order.length || next.some((id, index) => id !== order[index])) setOrder(next);
  return next;
}

export function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    return `€${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 2)}M`;
  }
  return `€${Math.round(price / 1000)}K`;
}

export function formatPriceFull(price: number): string {
  return `€${price.toLocaleString('en-US')}`;
}

export function formatPricePerSqm(value: number): string {
  return `€${value.toLocaleString('en-US')}/m²`;
}

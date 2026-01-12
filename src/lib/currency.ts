const zmwFormatter = new Intl.NumberFormat("en-ZM", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatZmw(amount: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `K ${zmwFormatter.format(safeAmount)}`;
}

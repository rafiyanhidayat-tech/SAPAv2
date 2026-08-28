export function formatRupiah(value) {
  const n = Number(value) || 0;
  return "Rp " + n.toLocaleString("id-ID");
}

export function daysBetween(checkin, checkout) {
  if (!checkin || !checkout) return 0;
  const a = new Date(checkin);
  const b = new Date(checkout);
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function formatDate(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export function computeAddonTotal(addon, days) {
  const price = Number(addon.price) || 0;
  const qty = Number(addon.qty) || 1;
  if (addon.type === "flat") return price;
  if (addon.type === "per_pax") return price * qty;
  if (addon.type === "per_qty_day") return price * qty * (days || 1);
  return price;
}

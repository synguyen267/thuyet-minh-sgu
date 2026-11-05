/** Sắp điểm theo thứ tự tuyến tham quan (cột tour_order). Điểm không có thứ tự xếp cuối. */
export function sortByTour(pois) {
  return [...(pois ?? [])].sort(
    (a, b) => (a.tour_order ?? Infinity) - (b.tour_order ?? Infinity)
  );
}

/** Điểm tiếp theo trên tuyến mà người dùng chưa nghe. null nếu đã đi hết. */
export function nextStop(pois, visitedIds = []) {
  const seen = new Set(visitedIds);
  return sortByTour(pois).find((p) => !seen.has(p.id)) ?? null;
}

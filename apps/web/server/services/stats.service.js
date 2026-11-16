/** Thống kê cho trang quản trị. statsRepoFor(token) trả về repository đã gắn với người gọi. */
export function createStatsService({ statsRepoFor }) {
  return {
    overview: (token) => statsRepoFor(token).overview(),
    /** maxRows bị kẹp trong khoảng 1 đến 5000 ô để không đọc quá nhiều. */
    heatCells(token, maxRows = 5000) {
      const n = Math.min(5000, Math.max(1, Number(maxRows) || 5000));
      return statsRepoFor(token).heatCells(n);
    },
  };
}

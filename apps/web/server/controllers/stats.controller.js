export function createStatsController(service) {
  return {
    overview: async (req, res) => res.json({ result: await service.overview(req.token) }),
    heat: async (req, res) => res.json({ result: await service.heatCells(req.token, req.query.max) }),
  };
}

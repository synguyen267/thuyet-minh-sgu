export function createAiController(service) {
  return {
    draft: async (req, res) => res.json({ result: await service.draft(req.body) }),
    translate: async (req, res) => res.json({ result: await service.translate(req.body) }),
  };
}

/** Nhận yêu cầu HTTP về điểm, gọi service rồi trả JSON. Không chứa quy tắc nghiệp vụ. */
export function createPoiController(service) {
  return {
    create: async (req, res) => res.status(201).json({ result: await service.create(req.token, req.body) }),
    update: async (req, res) => res.json({ result: await service.update(req.token, req.params.id, req.body) }),
    saveTranslation: async (req, res) =>
      res.json({ result: await service.saveTranslation(req.token, req.params.id, req.params.lang, req.body) }),
    plays: async (req, res) => res.json({ result: await service.countPlays(req.token, req.params.id) }),
    remove: async (req, res) => res.json({ result: await service.remove(req.token, req.params.id) }),
  };
}

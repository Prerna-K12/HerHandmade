const orders = require("../orders/orders.service");
const storage = require("../../services/storage");
const service = require("./public.service");
const { orderRef, trackingToken } = require("../../utils/ids");
const env = require("../../config/env");
const AppError = require("../../utils/AppError");

function sendImage(res, next, fileName) {
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.sendFile(storage.pathFor(fileName), (err) => {
    if (err) next(err.code === "ENOENT" ? new AppError(404, "NOT_FOUND", "File not found") : err);
  });
}

exports.createOrder = async (req, res) => {
  // Honeypot: only bots fill the hidden "website" field. Pretend it worked, save nothing.
  if (req.body.website) {
    return res.status(201).json({
      orderRef: orderRef(),
      message: "Order received. We have emailed you a tracking link.",
      trackingUrl: `${env.publicBaseUrl}/track/${trackingToken()}`,
    });
  }
   const { replayed, response } = await orders.createFromPublic(req.body);
  if (replayed) res.set("Idempotent-Replayed", "true"); // tells the caller this was a repeat
  res.status(201).json(response);
};

exports.track = async (req, res) => res.json(await orders.getTracking(req.params.token));

exports.trackPhoto = async (req, res, next) => {
  const fileName = await orders.getApprovedPhotoFile(req.params.token, req.params.mediaId);
  sendImage(res, next, fileName);
};

exports.groupView = async (req, res) => res.json(await service.groupView(req.params.code));

exports.groupMedia = async (req, res, next) => {
  const fileName = await service.groupMediaFile(req.params.code, req.params.fileName);
  sendImage(res, next, fileName);
};

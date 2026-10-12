import { Router } from "express";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import SupportMessage from "../models/supportMessage.model.js";
import { requireUser } from "../controllers/auth.controller.js";
import requireAdmin from "../middleware/requireAdmin.js";

export const publicSupportRouter = Router();
export const adminSupportRouter = Router();
const topics = [
  "General question",
  "Account support",
  "Academy and courses",
  "Trading challenge",
  "Broker collaboration",
  "Technical issue",
  "Other",
];
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
function validId(value) {
  if (!mongoose.isObjectIdOrHexString(value)) throw fail("Invalid message ID.");
  return value;
}
function text(value, name, min, max) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw fail(`${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
function safeMessage(item, admin = false) {
  const data = {
    id: String(item._id),
    name: item.name,
    email: item.email,
    topic: item.topic,
    subject: item.subject,
    message: item.message,
    status: item.status,
    createdAt: item.createdAt,
    replies: item.replies.map((reply) => ({
      id: String(reply._id),
      body: reply.body,
      createdAt: reply.createdAt,
    })),
  };
  if (admin)
    data.senderType = item.userId
      ? "Verified account"
      : "Guest · email not verified";
  return data;
}
function trustedMutation(req, res, next) {
  res.set("Cache-Control", "private, no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("Origin");
    const allowed = [process.env.FRONTEND_URL, process.env.ADMIN_FRONTEND_URL]
      .filter(Boolean)
      .map((value) => new URL(value.trim()).origin);
    if (
      req.get("X-CMM-Request") !== "1" ||
      (origin && !allowed.includes(origin))
    )
      return res.status(403).json({ message: "Request not allowed." });
    if (!req.is("application/json"))
      return res
        .status(400)
        .json({ message: "Send an application/json body." });
  }
  next();
}
publicSupportRouter.use(trustedMutation);
adminSupportRouter.use(requireUser, requireAdmin, trustedMutation);
const submitLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many messages. Please try again in 15 minutes." },
});
const readLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again shortly." },
});

publicSupportRouter.post(
  "/messages",
  requireUser,
  submitLimit,
  async (req, res, next) => {
    try {
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw fail("Send a JSON object.");
      if (
        Object.keys(body).some(
          (key) =>
            !["name", "email", "topic", "subject", "message"].includes(key),
        )
      )
        throw fail("Unsupported message fields.");
      const user = req.user;
      const name = text(user.username, "Name", 1, 100);
      const email = text(user.email, "Email", 3, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw fail("Enter a valid email.");
      if (!topics.includes(body.topic)) throw fail("Select a valid topic.");
      const subject = text(body.subject, "Subject", 1, 150);
      const message = text(body.message, "Message", 20, 2000);
      const item = await SupportMessage.create({
        userId: user._id,
        name,
        email,
        topic: body.topic,
        subject,
        message,
      });
      res
        .status(201)
        .json({
          message: "Message sent. Read replies in Dashboard → My Support.",
          ticket: safeMessage(item),
        });
    } catch (error) {
      next(error);
    }
  },
);
publicSupportRouter.get(
  "/messages",
  requireUser,
  readLimit,
  async (req, res, next) => {
    try {
      const items = await SupportMessage.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50);
      res.json({ messages: items.map((item) => safeMessage(item)) });
    } catch (error) {
      next(error);
    }
  },
);
publicSupportRouter.get(
  "/messages/:id",
  requireUser,
  readLimit,
  async (req, res, next) => {
    try {
      const item = await SupportMessage.findOne({
        _id: validId(req.params.id),
        userId: req.user._id,
      });
      if (!item) throw fail("Message not found.", 404);
      res.json({ ticket: safeMessage(item) });
    } catch (error) {
      next(error);
    }
  },
);

adminSupportRouter.get("/messages", async (req, res, next) => {
  try {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000)
      throw fail("Invalid page.");
    const status = req.query.status || "all";
    if (!["all", "open", "replied", "closed"].includes(status))
      throw fail("Invalid status.");
    const filter = status === "all" ? {} : { status };
    const [items, total] = await Promise.all([
      SupportMessage.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 20)
        .limit(20),
      SupportMessage.countDocuments(filter),
    ]);
    res.json({
      messages: items.map((item) => safeMessage(item, true)),
      total,
      page,
      limit: 20,
    });
  } catch (error) {
    next(error);
  }
});
adminSupportRouter.post("/messages/:id/replies", async (req, res, next) => {
  try {
    const body = text(req.body?.body, "Reply", 1, 4000);
    const item = await SupportMessage.findOneAndUpdate(
      {
        _id: validId(req.params.id),
        "replies.99": { $exists: false },
      },
      {
        $push: { replies: { body, adminId: req.user._id } },
        $set: { status: "replied" },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!item) throw fail("Message not found or reply limit reached.", 404);
    res.json({
      message:
        "Reply saved. Account users can read it in Dashboard → My Support.",
      ticket: safeMessage(item, true),
    });
  } catch (error) {
    next(error);
  }
});
adminSupportRouter.patch("/messages/:id", async (req, res, next) => {
  try {
    if (!["open", "closed"].includes(req.body?.status))
      throw fail("Choose open or closed.");
    const item = await SupportMessage.findByIdAndUpdate(
      validId(req.params.id),
      { $set: { status: req.body.status } },
      { returnDocument: "after", runValidators: true },
    );
    if (!item) throw fail("Message not found.", 404);
    res.json({
      message: "Message status updated.",
      ticket: safeMessage(item, true),
    });
  } catch (error) {
    next(error);
  }
});

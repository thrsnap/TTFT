import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "node:path";

import { randomUUID } from "node:crypto";
import { mkdirSync, createReadStream } from "node:fs";
import { unlink, stat } from "node:fs/promises";
import { tmpdir } from "node:os";

import { fileTypeFromFile } from "file-type";

import {
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

import {
  getR2,
  getR2Bucket,
  uploadR2File,
  deleteR2File,
} from "../config/r2.js";

import User from "../models/user.model.js";

import {
  Course,
  CourseEnrollment,
  CoursePayment,
} from "../models/course.model.js";

import { requireUser } from "../controllers/auth.controller.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = Router();

function inputError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function id(value) {
  if (!mongoose.isObjectIdOrHexString(value)) {
    throw inputError("Invalid ID.");
  }

  return value;
}

// Existing local lessons remain readable.
const uploadDirectory = path.resolve(
  process.env.COURSE_UPLOAD_DIR || "uploads/course-videos",
);

// New uploads are temporarily received here, then sent to R2.
const temporaryDirectory = path.join(
  tmpdir(),
  "cmm-course-uploads",
);

mkdirSync(temporaryDirectory, {
  recursive: true,
});

const temporaryStorage = multer.diskStorage({
  destination: temporaryDirectory,

  filename(req, file, callback) {
    callback(null, randomUUID());
  },
});

const coverUpload = multer({
  storage: temporaryStorage,

  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 1,
  },
});

const upload = multer({
  storage: temporaryStorage,

  limits: {
    fileSize: 500 * 1024 * 1024,
    files: 1,
    fields: 1,
    parts: 2,
    fieldSize: 1000,
  },
});

async function cleanTemporary(file) {
  if (!file?.path) return;

  try {
    await unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "Temporary cleanup failed:",
        error.code,
      );
    }
  }
}

async function cleanR2(key) {
  if (!key) return true;

  try {
    await deleteR2File(key);
    return true;
  } catch (error) {
    console.error("R2 cleanup failed:", error.name);
    return false;
  }
}

function summary(course, admin = false) {
  return {
    id: String(course._id),
    title: course.title,
    description: course.description,
    mentor: course.mentor,
    price: course.price,
    currency: course.currency,

    externalThumbnail: course.thumbnail || "",

    thumbnail: course.coverMimeType
      ? `/api/courses/${admin ? "admin/" : ""}${course._id}/cover?v=${
          course.coverUpdatedAt?.getTime() || 0
        }`
      : course.thumbnail,

    videoCount: course.lessons.length,
    status: course.status,
  };
}

async function canLearn(user, courseId) {
  if (user.role === "admin") return true;

  return Boolean(
    await CourseEnrollment.exists({
      userId: user._id,
      courseId,
    }),
  );
}

function courseFields(body) {
  const allowed = [
    "title",
    "description",
    "mentor",
    "price",
    "thumbnail",
    "status",
  ];

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw inputError("Send a JSON object.");
  }

  const unknown = Object.keys(body).filter(
    (key) => !allowed.includes(key),
  );

  if (unknown.length) {
    throw inputError(
      `Unknown fields: ${unknown.join(", ")}`,
    );
  }

  return Object.fromEntries(
    allowed
      .filter((key) => Object.hasOwn(body, key))
      .map((key) => [key, body[key]]),
  );
}

// Request protection.
router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");

  const mutation = !["GET", "HEAD", "OPTIONS"].includes(
    req.method,
  );

  if (mutation) {
    const allowed = [
      process.env.FRONTEND_URL,
      process.env.ADMIN_FRONTEND_URL,
    ]
      .filter(Boolean)
      .map((value) => new URL(value.trim()).origin);

    const origin = req.get("Origin");

    if (
      req.get("X-CMM-Request") !== "1" ||
      (origin && !allowed.includes(origin))
    ) {
      return res.status(403).json({
        message: "Request not allowed.",
      });
    }

    const multipartRoute =
      req.method === "POST" &&
      /^\/admin\/[a-fA-F0-9]{24}\/(lessons|cover)$/.test(
        req.path,
      );

    const validBody = multipartRoute
      ? req.is("multipart/form-data")
      : req.is("application/json") ||
        req.method === "DELETE";

    if (!validBody) {
      return res.status(400).json({
        message: multipartRoute
          ? "Send multipart/form-data."
          : "Send an application/json body.",
      });
    }
  }

  next();
});

// Public published-course list.
router.get("/", async (req, res, next) => {
  try {
    const courses = await Course.find({
      status: "published",
    })
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({
      // Explicit callback avoids passing the array index
      // as summary()'s admin argument.
      courses: courses.map((course) => summary(course)),
    });
  } catch (error) {
    next(error);
  }
});

// Current user's course access.
router.get("/my/access", requireUser, async (req, res, next) => {
  try {
    const entries = await CourseEnrollment.find({
      userId: req.user._id,
    })
      .select("courseId")
      .lean();

    res.json({
      courseIds: entries.map(
        (entry) => String(entry.courseId),
      ),
      isAdmin: req.user.role === "admin",
    });
  } catch (error) {
    next(error);
  }
});
router.get('/my', requireUser, async (req, res, next) => {
  try {
    const courseIds = await CourseEnrollment.distinct('courseId', {
      userId: req.user._id,
    })

    const courses = await Course.find({
      _id: { $in: courseIds },
    }).sort({ createdAt: -1 })

    res.json({
      courses: courses.map(course => summary(course)),
    })
  } catch (error) {
    next(error)
  }
})

// Admin course list.
router.get(
  "/admin",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const courses = await Course.find()
        .sort({ createdAt: -1 })
        .limit(200);

      res.json({
        courses: courses.map((course) => ({
          ...summary(course, true),

          lessons: course.lessons.map((lesson) => ({
            id: String(lesson._id),
            title: lesson.title,
          })),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Create a draft course.
router.post(
  "/admin",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const data = courseFields(req.body);

      if (data.status === "published") {
        throw inputError(
          "Create the course as a draft, upload a lesson, then publish it.",
        );
      }

      const course = await Course.create(data);

      res.status(201).json({
        course: summary(course, true),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Update course details or publication status.
router.patch(
  "/admin/:courseId",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const course = await Course.findById(
        id(req.params.courseId),
      );

      if (!course) {
        throw inputError("Course not found.", 404);
      }

      const data = courseFields(req.body);

      if (
        data.status === "published" &&
        !course.lessons.length
      ) {
        throw inputError(
          "Upload at least one lesson before publishing.",
        );
      }

      course.set(data);
      await course.save();

      res.json({
        course: summary(course, true),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Delete course and associated media.
router.delete(
  "/admin/:courseId",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const courseId = id(req.params.courseId);

      const course = await Course.findByIdAndDelete(
        courseId,
      );

      if (!course) {
        throw inputError("Course not found.", 404);
      }

      await CourseEnrollment.deleteMany({ courseId });
      await CoursePayment.deleteMany({ courseId });

      let cleanupFailed = false;

      if (!(await cleanR2(course.coverKey))) {
        cleanupFailed = true;
      }

      for (const lesson of course.lessons) {
        if (lesson.videoStorage === "r2") {
          if (!(await cleanR2(lesson.videoFile))) {
            cleanupFailed = true;
          }
        } else {
          const filename = path.join(
            uploadDirectory,
            path.basename(lesson.videoFile),
          );

          try {
            await unlink(filename);
          } catch (error) {
            if (error.code !== "ENOENT") {
              cleanupFailed = true;

              console.error(
                "Legacy video cleanup failed:",
                error.code,
              );
            }
          }
        }
      }

      res.json({
        message: cleanupFailed
          ? "Course deleted. Some media files could not be removed."
          : "Course deleted.",
      });
    } catch (error) {
      next(error);
    }
  },
);

// Delete one lesson; media cleanup starts only after MongoDB commits.
router.delete(
  "/admin/:courseId/lessons/:lessonId",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const courseId = id(req.params.courseId);
      const lessonId = id(req.params.lessonId);
      const course = await Course.findById(courseId);
      if (!course) throw inputError("Course not found.", 404);

      const lesson = course.lessons.id(lessonId);
      if (!lesson) throw inputError("Lesson not found in this course.", 404);

      // Read storage metadata from the selected lesson, never from the request body.
      const videoFile = lesson.videoFile;
      const videoStorage = lesson.videoStorage || "local";
      const removedId = String(lesson._id);

      course.lessons.pull(lesson._id);
      if (!course.lessons.length && course.status === "published") {
        course.status = "draft";
      }

      // Your model's optimisticConcurrency rejects conflicting edits before
      // any video file is deleted. A failed save leaves storage untouched.
      await course.save();

      let cleanupFailed = false;
      if (videoStorage === "r2") {
        cleanupFailed = !(await cleanR2(videoFile));
      } else {
        const filename = path.join(uploadDirectory, path.basename(videoFile));
        try {
          await unlink(filename);
        } catch (error) {
          if (error.code !== "ENOENT") cleanupFailed = true;
        }
      }

      if (cleanupFailed) {
        // Retain the exact stored key in server logs for manual cleanup.
        console.error("Deleted lesson media requires cleanup:", {
          courseId: String(course._id),
          lessonId: removedId,
          videoStorage,
          videoFile,
        });
      }

      res.json({
        success: true,
        deletedLessonId: removedId,
        cleanupFailed,
        message: cleanupFailed
          ? "Lesson removed from the course, but its video file could not be deleted. Check the backend logs for the stored file key."
          : "Lesson and its video file deleted.",
        course: {
          ...summary(course, true),
          lessons: course.lessons.map((item) => ({
            id: String(item._id),
            title: item.title,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Upload a lesson video to R2.
router.post(
  "/admin/:courseId/lessons",
  requireUser,
  requireAdmin,

  async (req, res, next) => {
    try {
      const course = await Course.findById(
        id(req.params.courseId),
      );

      if (!course) {
        throw inputError("Course not found.", 404);
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  upload.single("video"),

  async (req, res, next) => {
    let uploadedKey;
    let committed = false;

    try {
      if (!req.file || req.file.size < 1) {
        throw inputError(
          "Choose a nonempty video file.",
        );
      }

      const title =
        typeof req.body.title === "string"
          ? req.body.title.trim()
          : "";

      if (!title || title.length > 200) {
        throw inputError(
          "Enter a lesson title, maximum 200 characters.",
        );
      }

      const detected = await fileTypeFromFile(
        req.file.path,
      );

      if (
        !detected ||
        !["video/mp4", "video/webm"].includes(
          detected.mime,
        )
      ) {
        throw inputError("Use an MP4 or WebM video.");
      }

      const course = await Course.findById(
        req.params.courseId,
      );

      if (!course) {
        throw inputError("Course not found.", 404);
      }

      const key =
        `courses/${course._id}/lessons/` +
        `${randomUUID()}.${detected.ext}`;

      await uploadR2File({
        key,
        filePath: req.file.path,
        contentType: detected.mime,
        size: req.file.size,
      });

      uploadedKey = key;

      course.lessons.push({
        title,
        videoFile: key,
        videoStorage: "r2",
        contentType: detected.mime,
        size: req.file.size,
      });

      await course.save();
      committed = true;

      res.status(201).json({
        message: "Lesson uploaded to R2.",
      });
    } catch (error) {
      if (uploadedKey && !committed) {
        await cleanR2(uploadedKey);
      }

      next(error);
    } finally {
      await cleanTemporary(req.file);
    }
  },
);

// List pending payment requests.
router.get(
  "/admin/payments",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const payments = await CoursePayment.find({
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .populate("userId", "username email")
        .populate("courseId", "title");

      res.json({
        payments: payments.map((payment) => ({
          id: String(payment._id),
          reference: payment.reference,
          amount: payment.amount,
          currency: payment.currency,

          user: payment.userId
            ? {
                username: payment.userId.username,
                email: payment.userId.email,
              }
            : null,

          courseTitle:
            payment.courseId?.title ||
            "Unavailable course",
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Approve payment and grant course access.
router.post(
  "/admin/payments/:paymentId/approve",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (req.body?.paymentVerified !== true) {
        throw inputError(
          "Verify the received payment before granting access.",
        );
      }

      const payment = await CoursePayment.findById(
        id(req.params.paymentId),
      );

      if (!payment) {
        throw inputError(
          "Payment request not found.",
          404,
        );
      }

      if (
        !(await Course.exists({
          _id: payment.courseId,
        }))
      ) {
        throw inputError(
          "Course no longer exists.",
          404,
        );
      }

      await CourseEnrollment.updateOne(
        {
          userId: payment.userId,
          courseId: payment.courseId,
        },
        {
          $setOnInsert: {
            grantedBy: req.user._id,
            grantedAt: new Date(),
          },
        },
        {
          upsert: true,
          runValidators: true,
        },
      );

      payment.status = "approved";
      payment.approvedBy = req.user._id;
      payment.approvedAt = new Date();

      await payment.save();

      res.json({
        message: "Course access granted.",
      });
    } catch (error) {
      next(error);
    }
  },
);

// Upload a course cover to R2.
router.post(
  "/admin/:courseId/cover",
  requireUser,
  requireAdmin,

  async (req, res, next) => {
    try {
      const exists = await Course.exists({
        _id: id(req.params.courseId),
      });

      if (!exists) {
        throw inputError("Course not found.", 404);
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  coverUpload.single("cover"),

  async (req, res, next) => {
    let uploadedKey;
    let committed = false;

    try {
      if (!req.file || req.file.size < 1) {
        throw inputError(
          "Choose a nonempty JPG or PNG cover.",
        );
      }

      const detected = await fileTypeFromFile(
        req.file.path,
      );

      if (
        !detected ||
        !["image/jpeg", "image/png"].includes(
          detected.mime,
        )
      ) {
        throw inputError(
          "Only JPG and PNG covers are supported.",
        );
      }

      const course = await Course.findById(
        req.params.courseId,
      );

      if (!course) {
        throw inputError("Course not found.", 404);
      }

      const previousKey = course.coverKey;

      const key =
        `courses/${course._id}/covers/` +
        `${randomUUID()}.${detected.ext}`;

      await uploadR2File({
        key,
        filePath: req.file.path,
        contentType: detected.mime,
        size: req.file.size,
      });

      uploadedKey = key;

      const updated = await Course.findOneAndUpdate(
        {
          _id: course._id,
          __v: course.__v,
        },
        {
          $set: {
            coverKey: key,
            coverMimeType: detected.mime,
            coverUpdatedAt: new Date(),
          },

          $unset: {
            coverImage: "",
          },

          $inc: {
            __v: 1,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      );

      if (!updated) {
        throw inputError(
          "The course changed. Refresh and try again.",
          409,
        );
      }

      committed = true;

      const cleaned = await cleanR2(previousKey);

      res.json({
        message: cleaned
          ? "Course cover uploaded to R2."
          : "Cover uploaded. The previous R2 cover could not be removed.",

        course: summary(updated, true),
      });
    } catch (error) {
      if (uploadedKey && !committed) {
        await cleanR2(uploadedKey);
      }

      next(error);
    } finally {
      await cleanTemporary(req.file);
    }
  },
);

// Admin cover preview, including draft courses.
router.get(
  "/admin/:courseId/cover",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const course = await Course.findById(
        id(req.params.courseId),
      ).select("+coverImage");

      if (!course) {
        throw inputError("Course not found.", 404);
      }

      await sendCover(course, req, res);
    } catch (error) {
      next(error);
    }
  },
);

async function sendCover(course, req, res) {
  res.set("X-Content-Type-Options", "nosniff");

  if (course.coverKey) {
    const object = await getR2().send(
      new GetObjectCommand({
        Bucket: getR2Bucket(),
        Key: course.coverKey,
      }),
    );

    res.set(
      "Content-Type",
      object.ContentType || course.coverMimeType,
    );

    if (object.ContentLength !== undefined) {
      res.set(
        "Content-Length",
        String(object.ContentLength),
      );
    }

    if (req.method === "HEAD") {
      object.Body?.destroy();
      return res.end();
    }

    object.Body.on("error", (error) => {
      res.destroy(error);
    });

    res.on("close", () => {
      object.Body.destroy();
    });

    object.Body.pipe(res);
    return;
  }

  // Compatibility with existing MongoDB covers.
  if (!course.coverImage || !course.coverMimeType) {
    throw inputError("Course cover not found.", 404);
  }

  res.set("Content-Type", course.coverMimeType);
  res.send(course.coverImage);
}

// List users with course access.
router.get(
  "/admin/:courseId/access",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const courseId = id(req.params.courseId);

      if (!(await Course.exists({ _id: courseId }))) {
        throw inputError("Course not found.", 404);
      }

      const entries = await CourseEnrollment.find({
        courseId,
      })
        .populate("userId", "username email")
        .sort({ grantedAt: -1 });

      res.json({
        enrollments: entries.map((entry) => ({
          id: String(entry._id),

          userId: entry.userId
            ? String(entry.userId._id)
            : null,

          username:
            entry.userId?.username ||
            "Unavailable user",

          email: entry.userId?.email || "",
          grantedAt: entry.grantedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Manually grant access using a registered email.
router.post(
  "/admin/:courseId/access",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const courseId = id(req.params.courseId);

      const email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";

      if (!email || email.length > 254) {
        throw inputError(
          "Enter the registered user email.",
        );
      }

      const course = await Course.findById(courseId);

      if (!course) {
        throw inputError("Course not found.", 404);
      }

      const user = await User.findOne({ email });

      if (!user) {
        throw inputError(
          "No registered user has this email.",
          404,
        );
      }

      await CourseEnrollment.updateOne(
        {
          userId: user._id,
          courseId: course._id,
        },
        {
          $setOnInsert: {
            grantedBy: req.user._id,
            grantedAt: new Date(),
          },
        },
        {
          upsert: true,
          runValidators: true,
        },
      );

      res.json({
        message:
          `Course access granted to ${user.email}.`,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Revoke a user's access.
router.delete(
  "/admin/:courseId/access/:userId",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const courseId = id(req.params.courseId);
      const userId = id(req.params.userId);

      await CourseEnrollment.deleteOne({
        userId,
        courseId,
      });

      res.json({
        message: "Course access revoked.",
      });
    } catch (error) {
      next(error);
    }
  },
);

// Public cover for published courses.
// FIX: coverKey must be included in this projection.
router.get("/:courseId/cover", async (req, res, next) => {
  try {
    const course = await Course.findOne({
      _id: id(req.params.courseId),
      status: "published",
    }).select("coverKey coverMimeType +coverImage");

    if (!course) {
      throw inputError(
        "Course cover not found.",
        404,
      );
    }

    await sendCover(course, req, res);
  } catch (error) {
    next(error);
  }
});

// Public course details.
router.get("/:courseId", async (req, res, next) => {
  try {
    const course = await Course.findOne({
      _id: id(req.params.courseId),
      status: "published",
    });

    if (!course) {
      throw inputError("Course not found.", 404);
    }

    res.json({
      course: summary(course),

      paymentInstructions:
        process.env.COURSE_PAYMENT_INSTRUCTIONS ||
        "Contact support for payment instructions.",
    });
  } catch (error) {
    next(error);
  }
});

// Submit a payment reference for review.
router.post(
  "/:courseId/payment-request",
  requireUser,
  async (req, res, next) => {
    try {
      const course = await Course.findOne({
        _id: id(req.params.courseId),
        status: "published",
      });

      if (!course) {
        throw inputError("Course not found.", 404);
      }

      if (await canLearn(req.user, course._id)) {
        throw inputError(
          "You already have access to this course.",
          409,
        );
      }

      const reference =
        typeof req.body?.reference === "string"
          ? req.body.reference.trim()
          : "";

      if (
        reference.length < 3 ||
        reference.length > 120
      ) {
        throw inputError(
          "Enter a payment reference between 3 and 120 characters.",
        );
      }

      const previous = await CoursePayment.findOne({
        userId: req.user._id,
        courseId: course._id,
        status: "pending",
      });

      if (previous) {
        throw inputError(
          "Your payment request is already awaiting review.",
          409,
        );
      }

      await CoursePayment.create({
        userId: req.user._id,
        courseId: course._id,
        reference,
        amount: course.price,
        currency: course.currency,
      });

      res.status(201).json({
        message:
          "Payment reference submitted. Access is granted after admin verification.",
      });
    } catch (error) {
      next(error);
    }
  },
);

// Protected lesson list.
router.get(
  "/:courseId/lessons",
  requireUser,
  async (req, res, next) => {
    try {
      const course = await Course.findById(
        id(req.params.courseId),
      );

      if (!course) {
        throw inputError("Course not found.", 404);
      }

      if (!(await canLearn(req.user, course._id))) {
        throw inputError(
          "Purchase this course to access its lessons.",
          403,
        );
      }

      res.json({
        course: summary(course),

        lessons: course.lessons.map((lesson) => ({
          id: String(lesson._id),
          title: lesson.title,

          videoUrl:
            `/api/courses/${course._id}` +
            `/lessons/${lesson._id}/video`,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Protected R2/local video streaming with range support.
router.get(
  "/:courseId/lessons/:lessonId/video",
  requireUser,
  async (req, res, next) => {
    try {
      const course = await Course.findById(
        id(req.params.courseId),
      );

      if (!course) {
        throw inputError("Course not found.", 404);
      }

      if (!(await canLearn(req.user, course._id))) {
        throw inputError(
          "Purchase this course to watch this video.",
          403,
        );
      }

      const lesson = course.lessons.id(
        id(req.params.lessonId),
      );

      if (!lesson) {
        throw inputError("Lesson not found.", 404);
      }

      const isR2 = lesson.videoStorage === "r2";

      let filename;
      let size;

      if (isR2) {
        const info = await getR2().send(
          new HeadObjectCommand({
            Bucket: getR2Bucket(),
            Key: lesson.videoFile,
          }),
        );

        size = info.ContentLength;
      } else {
        filename = path.join(
          uploadDirectory,
          path.basename(lesson.videoFile),
        );

        const info = await stat(filename).catch(
          (error) => {
            if (error.code === "ENOENT") {
              throw inputError(
                "Video file not found.",
                404,
              );
            }

            throw error;
          },
        );

        size = info.size;
      }

      if (
        !Number.isSafeInteger(size) ||
        size < 1
      ) {
        throw inputError(
          "Video file is empty or unavailable.",
          404,
        );
      }

      res.set("Accept-Ranges", "bytes");
      res.set("Content-Type", lesson.contentType);
      res.set("X-Content-Type-Options", "nosniff");

      let start = 0;
      let end = size - 1;
      let partial = false;

      const range = req.headers.range;

      if (range) {
        const match =
          /^bytes=(\d*)-(\d*)$/.exec(range);

        if (
          !match ||
          (!match[1] && !match[2])
        ) {
          res.set(
            "Content-Range",
            `bytes */${size}`,
          );

          return res.sendStatus(416);
        }

        if (!match[1]) {
          const suffix = Number(match[2]);

          if (
            !Number.isSafeInteger(suffix) ||
            suffix <= 0
          ) {
            res.set(
              "Content-Range",
              `bytes */${size}`,
            );

            return res.sendStatus(416);
          }

          start = Math.max(0, size - suffix);
        } else {
          start = Number(match[1]);

          if (match[2]) {
            end = Math.min(
              Number(match[2]),
              size - 1,
            );
          }
        }

        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start < 0 ||
          start >= size ||
          end < start
        ) {
          res.set(
            "Content-Range",
            `bytes */${size}`,
          );

          return res.sendStatus(416);
        }

        partial = true;
      }

      res.status(partial ? 206 : 200);

      if (partial) {
        res.set(
          "Content-Range",
          `bytes ${start}-${end}/${size}`,
        );
      }

      res.set(
        "Content-Length",
        String(end - start + 1),
      );

      if (req.method === "HEAD") {
        return res.end();
      }

      let stream;

      if (isR2) {
        const object = await getR2().send(
          new GetObjectCommand({
            Bucket: getR2Bucket(),
            Key: lesson.videoFile,

            ...(partial
              ? {
                  Range: `bytes=${start}-${end}`,
                }
              : {}),
          }),
        );

        stream = object.Body;
      } else {
        stream = createReadStream(filename, {
          start,
          end,
        });
      }

      stream.on("error", next);

      res.on("close", () => {
        stream.destroy();
      });

      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  },
);

// Route error handling.
router.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.name === "VersionError") {
    return res.status(409).json({
      message:
        "The course changed. Refresh and try again.",
    });
  }

  if (
    ["NoSuchKey", "NotFound"].includes(
      error.name,
    )
  ) {
    return res.status(404).json({
      message: "Media file not found in R2.",
    });
  }

  if (error instanceof multer.MulterError) {
    const tooLarge =
      error.code === "LIMIT_FILE_SIZE";

    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge
        ? req.path.endsWith("/cover")
          ? "Maximum cover size is 2 MB."
          : "Maximum video size is 500 MB."
        : error.message,
    });
  }

  next(error);
});

export default router;
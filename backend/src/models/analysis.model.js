import mongoose from "mongoose";

function isHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
const analysisSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      enum: ["ICT", "PDArray", "CSNR", "SMS"],
      required: true,
    },
    symbol: { type: String, required: true, trim: true, uppercase: true },
    timeframe: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    pictures: {
      type: [String],
      default: [],
      validate: {
        validator: (values) => values.length <= 10 && values.every(isHttpUrl),
        message: "Provide at most 10 valid HTTP/HTTPS chart URLs.",
      },
    },
    imageIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    details: { type: String, required: true, maxlength: 20000 },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
  },
  { timestamps: true },
);
const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    type: {
      type: String,
      enum: ["PDF", "Word Document", "ZIP", "Other"],
      required: true,
    },
    url: {
      type: String,
      required: function () {
        return !this.hasFile;
      },
      validate: {
        validator: (value) => !value || isHttpUrl(value),
        message: "Provide a valid HTTP/HTTPS document URL.",
      },
    },
    hasFile: { type: Boolean, default: false },
    fileData: { type: Buffer, select: false },
    filename: String,
    contentType: String,
    status: { type: String, enum: ["draft", "published"], default: "draft" },
  },
  { timestamps: true },
);
const imageSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    data: { type: Buffer, required: true, select: false },
    contentType: { type: String, default: "image/webp" },
  },
  { timestamps: true },
);
export const AnalysisPost = mongoose.model("AnalysisPost", analysisSchema);
export const AnalysisDocument = mongoose.model(
  "AnalysisDocument",
  documentSchema,
);
export const AnalysisImage = mongoose.model("AnalysisImage", imageSchema);

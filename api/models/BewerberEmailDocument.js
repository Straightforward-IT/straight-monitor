const mongoose = require("mongoose");

const BewerberEmailDocumentSchema = new mongoose.Schema(
  {
    teamKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, unique: true },
    contentType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

BewerberEmailDocumentSchema.index({ teamKey: 1, isActive: 1, name: 1 });

module.exports = mongoose.model("BewerberEmailDocument", BewerberEmailDocumentSchema);
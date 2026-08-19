const mongoose = require("mongoose");

const EmployeeEmailTemplateSchema = new mongoose.Schema(
  {
    teamKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    locationV2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    subjectTemplate: { type: String, required: true, trim: true, maxlength: 250 },
    htmlTemplate: { type: String, required: true, maxlength: 2000000 },
    attachments: [
      { type: mongoose.Schema.Types.ObjectId, ref: "BewerberEmailDocument" },
    ],
    sourceMessageId: { type: String, default: null, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

EmployeeEmailTemplateSchema.index({ teamKey: 1, locationV2: 1, name: 1 });

module.exports = mongoose.model("EmployeeEmailTemplate", EmployeeEmailTemplateSchema);

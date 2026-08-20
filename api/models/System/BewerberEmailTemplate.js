const mongoose = require("mongoose");

const INVITATION_TYPES = ["vertrag", "vertrag_service", "vertrag_logistik"];

const BewerberEmailTemplateSchema = new mongoose.Schema(
  {
    teamKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    locationV2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      default: null,
      index: true,
    },
    type: { type: String, enum: INVITATION_TYPES, required: true },
    subjectTemplate: { type: String, required: true, trim: true, maxlength: 250 },
    htmlTemplate: { type: String, required: true, maxlength: 50000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

BewerberEmailTemplateSchema.index(
  { teamKey: 1, locationV2: 1, type: 1 },
  { unique: true }
);

module.exports = mongoose.model("BewerberEmailTemplate", BewerberEmailTemplateSchema);
module.exports.INVITATION_TYPES = INVITATION_TYPES;

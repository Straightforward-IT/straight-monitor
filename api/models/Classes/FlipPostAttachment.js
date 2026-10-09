/** Attachment derivative returned by Posts v4. */
class FlipPostAttachmentVariant {
  constructor(data = {}) {
    this.id = data.id;
    this.attachment_id = data.attachment_id;
    /** @type {'ORIGINAL'|'VIDEO_POSTER'|'VIDEO_SMALL'|'VIDEO_BIG'|'IMAGE_STANDARD'|'AUDIO_WAVEFORM'|'AUDIO_OPUS'|'AUDIO_AAC'|undefined} */
    this.variant = data.variant;
    /** @type {'PENDING'|'READY'|'FAILED'|undefined} */
    this.status = data.status;
    this.location = data.location;
    this.mime_type = data.mime_type;
    /** File size in bytes. @type {number|undefined} */
    this.size = data.size;
    this.file_name = data.file_name;
  }
}

/** Shared by top-level and localized header/inline/standard attachments. */
class FlipPostAttachment {
  constructor(data = {}) {
    this.id = data.id;
    this.filename = data.filename;
    this.link = data.link;
    this.mime_type = data.mime_type;
    /** @type {'VIDEO'|'VOICE'|'IMAGE'|'MISC'|undefined} */
    this.category = data.category;
    this.meta_data = data.meta_data == null ? data.meta_data : {
      width: data.meta_data.width,
      height: data.meta_data.height,
      size: data.meta_data.size,
    };
    /** @type {FlipPostAttachmentVariant[]|null|undefined} */
    this.variants = data.variants == null ? data.variants : data.variants.map(item => new FlipPostAttachmentVariant(item));
    /** @type {'WEB'|'MOBILE'|'EXT_API'|'WEB_KLIPY'|'MOBILE_KLIPY'|'LIVESTREAM'|undefined} */
    this.source = data.source;
    /** Short-lived video access token. @type {string|undefined} */
    this.media_token = data.media_token;
  }
}

module.exports = FlipPostAttachment;

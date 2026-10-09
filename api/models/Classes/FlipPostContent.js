const FlipPostAttachment = require("./FlipPostAttachment");

/** One localized content variant from Posts v4. Missing values remain missing.
 * Body values stay strings for HTML, PLAIN and serialized DELTA content.
 */
class FlipPostContent {
  /** @param {Partial<FlipPostContent>} [data] */
  constructor(data = {}) {
    /** Returned content locale, e.g. de-DE. @type {string|undefined} */
    this.language = data.language;
    /** Detected source locale. @type {string|undefined} */
    this.detected_language = data.detected_language;
    /** Whether Flip translated this variant automatically. @type {boolean|undefined} */
    this.auto_translated = data.auto_translated;
    /** Whether this is the primary language variant. @type {boolean|undefined} */
    this.primary_language = data.primary_language;
    /** Plain-text title; authoring limit is 150 perceived characters. @type {string|undefined} */
    this.title = data.title;
    /** @type {{format: 'HTML'|'DELTA'|'PLAIN', value: string}|null|undefined} */
    this.body = data.body == null ? data.body : {
      format: data.body.format,
      value: data.body.value,
    };
    /** API timestamp string. @type {string|undefined} */
    this.edited_at = data.edited_at;
    /** @type {string[]|undefined} */
    this.header_attachment_ids = data.header_attachment_ids;
    /** @type {string[]|undefined} */
    this.inline_attachment_ids = data.inline_attachment_ids;
    /** @type {string[]|undefined} */
    this.standard_attachment_ids = data.standard_attachment_ids;
    /** Optional ATTACHMENTS embed. @type {FlipPostAttachment[]|null|undefined} */
    this.header_attachments = data.header_attachments == null ? data.header_attachments : data.header_attachments.map(item => new FlipPostAttachment(item));
    /** Optional ATTACHMENTS embed. @type {FlipPostAttachment[]|null|undefined} */
    this.inline_attachments = data.inline_attachments == null ? data.inline_attachments : data.inline_attachments.map(item => new FlipPostAttachment(item));
    /** Optional ATTACHMENTS embed. @type {FlipPostAttachment[]|null|undefined} */
    this.standard_attachments = data.standard_attachments == null ? data.standard_attachments : data.standard_attachments.map(item => new FlipPostAttachment(item));
  }
}

module.exports = FlipPostContent;

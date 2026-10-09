const { flipAxios } = require("../../services/integrations/flipAxios");
const FlipPostChannel = require("./FlipPostChannel");
const FlipPostContent = require("./FlipPostContent");
const FlipPostUser = require("./FlipPostUser");
const FlipPostAttachment = require("./FlipPostAttachment");
const FlipPostSurvey = require("./FlipPostSurvey");

const ARRAY_FILTERS = {
  channel_id: null,
  status: ["PUBLISHED", "SCHEDULED", "ARCHIVED", "WAITING_FOR_APPROVAL"],
  sort: ["PUBLISHED_AT_DESC", "PUBLISHED_AT_ASC", "SCHEDULED_AT_DESC", "SCHEDULED_AT_ASC", "CREATED_AT_DESC", "CREATED_AT_ASC"],
  embed: ["AUTHOR", "CHANNEL", "REACTIONS_SUMMARY", "COMMENTS_SUMMARY", "SURVEYS", "SURVEY_LAST_VOTERS", "BOOKMARK", "ATTACHMENTS", "VIEWS_COUNT"],
};
const BOOLEAN_FILTERS = ["only_highlighted", "only_newsfeed", "only_schedulable_channels"];
const STRING_FILTERS = ["author_id", "date_from", "date_to", "page_cursor", "target_language", "content_format"];

function invalidQuery(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function normalizeParams(input) {
  const params = {};
  for (const [key, allowed] of Object.entries(ARRAY_FILTERS)) {
    if (input[key] === undefined) continue;
    const values = Array.isArray(input[key]) ? input[key] : [input[key]];
    if (!values.length || values.some(value => typeof value !== "string" || !value || (allowed && !allowed.includes(value)))) {
      invalidQuery(`Invalid ${key} filter.`);
    }
    params[key] = values;
  }
  for (const key of BOOLEAN_FILTERS) {
    if (input[key] === undefined) continue;
    if (![true, false, "true", "false"].includes(input[key])) invalidQuery(`Invalid ${key} filter.`);
    params[key] = input[key] === true || input[key] === "true";
  }
  for (const key of STRING_FILTERS) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "string" || !input[key]) invalidQuery(`Invalid ${key} filter.`);
    params[key] = input[key];
  }
  if (input.page_limit !== undefined) {
    if (!["string", "number"].includes(typeof input.page_limit)
      || !/^[1-9]\d*$/.test(String(input.page_limit)) || !Number.isSafeInteger(Number(input.page_limit))) {
      invalidQuery("page_limit must be a positive integer.");
    }
    params.page_limit = Number(input.page_limit);
  }
  if (params.content_format && !["PLAIN", "DELTA", "HTML"].includes(params.content_format)) {
    invalidQuery("Invalid content_format.");
  }
  if (params.only_newsfeed && (params.channel_id || params.only_schedulable_channels)) {
    invalidQuery("only_newsfeed cannot be combined with channel_id or only_schedulable_channels=true.");
  }
  if (params.date_from || params.date_to) {
    if (!params.status?.length || params.status.some(status => !["PUBLISHED", "SCHEDULED"].includes(status))) {
      invalidQuery("Date filters require PUBLISHED and/or SCHEDULED status.");
    }
    for (const key of ["date_from", "date_to"]) {
      if (params[key] && !Number.isFinite(Date.parse(params[key]))) invalidQuery(`Invalid ${key} timestamp.`);
    }
    if (params.date_from && params.date_to && Date.parse(params.date_to) < Date.parse(params.date_from)) {
      invalidQuery("date_to must not precede date_from.");
    }
  }
  return params;
}

/** Flip Posts v4 response model, following FlipPage (no local persistence).
 * Nested API objects retain their wire shape, including localization, surveys,
 * attachments and actor-specific visibility. Missing embeds are not synthesized.
 */
class FlipPost {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.external_id = data.external_id;
    this.channel_id = data.channel_id ?? null;
    this.channel = data.channel == null ? data.channel : new FlipPostChannel(data.channel);
    this.author_id = data.author_id ?? null;
    /** @type {FlipPostUser|null|undefined} */
    this.author = data.author == null ? data.author : new FlipPostUser(data.author);
    this.info = data.info == null ? null : {
      published_at: data.info.published_at,
      scheduled_at: data.info.scheduled_at,
      archived_at: data.info.archived_at,
      highlighted_until: data.info.highlighted_until,
      highlighted_at: data.info.highlighted_at,
      created_at: data.info.created_at,
      updated_at: data.info.updated_at,
      // Response statuses also include DRAFT; do not restrict to filter values.
      status: data.info.status,
    };
    this.available_languages = data.available_languages == null ? data.available_languages : data.available_languages.map(item => ({
      locale: item.locale,
      primary: item.primary,
    }));
    /** Localized content variants; select a language before reading title/body.
     * @type {FlipPostContent[]|null|undefined}
     */
    this.content = data.content == null ? data.content : data.content.map(item => new FlipPostContent(item));
    this.header_attachment_ids = data.header_attachment_ids;
    this.standard_attachment_ids = data.standard_attachment_ids;
    /** @type {FlipPostAttachment[]|null|undefined} */
    this.header_attachments = data.header_attachments == null ? data.header_attachments : data.header_attachments.map(item => new FlipPostAttachment(item));
    /** @type {FlipPostAttachment[]|null|undefined} */
    this.standard_attachments = data.standard_attachments == null ? data.standard_attachments : data.standard_attachments.map(item => new FlipPostAttachment(item));
    this.reactions_summary = data.reactions_summary == null ? data.reactions_summary : {
      total: data.reactions_summary.total,
      items: data.reactions_summary.items == null ? data.reactions_summary.items : data.reactions_summary.items.map(item => ({
        count: item.count,
        icon: item.icon,
        type: item.type,
        unicode_reaction: item.unicode_reaction,
        by_actor: item.by_actor,
      })),
    };
    this.comments_summary = data.comments_summary == null ? data.comments_summary : {
      total: data.comments_summary.total,
    };
    this.settings = data.settings == null ? null : {
      reactions_enabled: data.settings.reactions_enabled,
      comments_enabled: data.settings.comments_enabled,
    };
    this.livestream_id = data.livestream_id;
    this.mentions = data.mentions == null ? data.mentions : data.mentions.map(item => ({
      mentioned_user_id: item.mentioned_user_id,
      mention_name: item.mention_name,
      user_is_deleted: item.user_is_deleted,
    }));
    /** @type {FlipPostSurvey[]|null|undefined} */
    this.surveys = data.surveys == null ? data.surveys : data.surveys.map(item => new FlipPostSurvey(item));
    this.bookmarked = data.bookmarked;
    this.views_count = data.views_count;
  }

  /** Fetch one page; continue with pagination.next_cursor when has_more is true. */
  static async list(params = {}, { acceptLanguage } = {}) {
    const response = await flipAxios.get("/api/posts/v4/posts", {
      params: normalizeParams(params),
      // Repeated keys are an explicit convention; verify against the live Flip API.
      paramsSerializer: { indexes: null },
      ...(acceptLanguage && { headers: { "Accept-Language": acceptLanguage } }),
    });
    const data = response.data;
    if (!Array.isArray(data?.posts) || typeof data.pagination?.has_more !== "boolean"
      || (data.pagination.has_more && (typeof data.pagination.next_cursor !== "string" || !data.pagination.next_cursor))) {
      const error = new Error("Unexpected Flip posts response shape.");
      error.statusCode = 502;
      throw error;
    }
    return {
      posts: data.posts.map(post => new FlipPost(post)),
      pagination: {
        next_cursor: data.pagination.next_cursor,
        has_more: data.pagination.has_more,
      },
    };
  }
}

module.exports = FlipPost;

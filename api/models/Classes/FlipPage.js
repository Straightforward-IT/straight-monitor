const { flipAxios } = require("../../flipAxios");

class FlipPage {
  constructor(data = {}) {
    this.id = data.id || null;
    this.external_id = data.external_id || null;
    this.publication_status = data.publication_status || "DRAFT";
    this.parent_id = data.parent_id || null;
    this.managing_user_group_id = data.managing_user_group_id || null;
    this.managing_user_group = data.managing_user_group || null;
    this.managing_user_group_path = data.managing_user_group_path || [];

    // Top-level localized title — present in list responses
    // Shape: { language: "de-DE", auto_translated: bool, text: "..." }
    this.title = data.title || null;

    // Full content object — present in single-page (get/create/update) responses
    this.content = data.content
      ? {
          language: data.content.language || null,
          auto_translated: data.content.auto_translated || false,
          auto_translation_status: data.content.auto_translation_status || null,
          title: data.content.title || null,
          body: data.content.body
            ? {
                plain: data.content.body.plain || null,
                delta: data.content.body.delta || [],
                html: data.content.body.html || null,
              }
            : null,
          banner_image: data.content.banner_image || null,
          inline_attachments: data.content.inline_attachments || [],
          standard_attachments: data.content.standard_attachments || [],
        }
      : null;

    this.banner_image = data.banner_image || null;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.original_language = data.original_language || null;
    this.has_sub_pages = data.has_sub_pages || false;
    this.allow_attachment_download = data.allow_attachment_download ?? false;
    this.page_path = data.page_path || [];
    this.order_number = data.order_number ?? null;
    this.translation_information = data.translation_information || [];
    this.actions = data.actions || null;
  }

  /**
   * List pages. Returns a single API page (no auto-pagination).
   * Use page_limit + page_cursor for manual pagination.
   * Key filter params: page_id, tree_mode (DIRECT_SUB_PAGES | ONLY_MAIN_PAGES),
   *   publication_statuses (array), page_limit, page_cursor, search_term.
   */
  static async list(params = {}) {
    const response = await flipAxios.get("/api/pages/v4/pages/", { params });
    return {
      pages: (response.data.pages || []).map((p) => new FlipPage(p)),
      pagination: response.data.pagination || null,
      actions: response.data.actions || null,
    };
  }

  /**
   * Create a new page in Flip.
   * Required: content (with title + language), plus either parent_id OR managing_user_group_id.
   */
  async create() {
    const payload = {
      ...(this.id && { id: this.id }),
      ...(this.external_id && { external_id: this.external_id }),
      ...(this.publication_status && { publication_status: this.publication_status }),
      ...(this.parent_id && { parent_id: this.parent_id }),
      ...(this.managing_user_group_id && { managing_user_group_id: this.managing_user_group_id }),
      ...(this.content && { content: this.content }),
      ...(this.allow_attachment_download !== undefined && {
        allow_attachment_download: this.allow_attachment_download,
      }),
    };

    const response = await flipAxios.post("/api/pages/v4/pages/", payload);
    return new FlipPage(response.data);
  }

  /**
   * Get a single page by its Flip ID.
   * Optional params: content_format, embed, target_language, auto_translation, include_archived.
   */
  static async getById(pageId, params = {}) {
    const response = await flipAxios.get(`/api/pages/v4/pages/${pageId}`, { params });
    return new FlipPage(response.data);
  }

  /**
   * Get a page by its external_id.
   * Optional params: content_format, embed, target_language, auto_translation, include_archived.
   */
  static async getByExternalId(externalId, params = {}) {
    const response = await flipAxios.get(
      `/api/pages/v4/pages/external-id/${externalId}`,
      { params }
    );
    return new FlipPage(response.data);
  }

  /**
   * Partially update a page (JSON Merge Patch).
   * Pass the patch payload directly — only include fields to change.
   * Example: { content: { body: { content_format: "HTML", html: "<p>...</p>" } } }
   */
  async update(pageId, patch) {
    const id = pageId || this.id;
    if (!id) throw new Error("Cannot update page: missing id.");

    const response = await flipAxios.patch(
      `/api/pages/v4/pages/${id}`,
      patch,
      { headers: { "Content-Type": "application/merge-patch+json" } }
    );
    return new FlipPage(response.data);
  }

  /**
   * Archive a page. The page will no longer be visible to regular users.
   */
  static async archive(pageId) {
    const response = await flipAxios.post(`/api/pages/v4/pages/${pageId}/archive`);
    return response.data;
  }

  /**
   * Move a page relative to a reference page.
   * @param {string} direction — "BEFORE" | "AFTER" | "INTO" (first child)
   */
  static async move(pageId, reference_page_id, direction) {
    const response = await flipAxios.post(`/api/pages/v4/pages/${pageId}/move`, {
      reference_page_id,
      direction,
    });
    return response.data;
  }

  toSimplifiedObject() {
    return {
      id: this.id,
      external_id: this.external_id,
      publication_status: this.publication_status,
      parent_id: this.parent_id,
      title: this.title?.text || this.content?.title || null,
      has_sub_pages: this.has_sub_pages,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

module.exports = FlipPage;

const { flipAxios } = require("../../services/integrations/flipAxios");

const EMBEDS = ["ACTIONS", "MANAGING_USER_GROUP", "DEFAULT_ROLE", "ACTOR_ROLE"];
const CHANNEL_ACTIONS = ["view", "delete", "archive", "edit", "view_assigned_users",
  "assign_users", "view_assigned_user_groups", "assign_user_groups"];

function localizedTitle(data) {
  return data == null ? data : { language: data.language, text: data.text };
}

function actionPermissions(data, names) {
  if (data == null) return data;
  return Object.fromEntries(names.filter(name => data[name] !== undefined).map(name => [
    name, data[name] == null ? data[name] : { allowed: data[name].allowed },
  ]));
}

/** Admin Channels v4 resource. Optional embeds stay absent/null as supplied.
 * Permission flags are snapshots; only an explicit allowed=true grants a capability.
 * This is an API class, without MongoDB persistence.
 */
class FlipChannel {
  constructor(data = {}) {
    /** @type {string|undefined} */
    this.channel_id = data.channel_id;
    this.managing_user_group_id = data.managing_user_group_id;
    this.managing_user_group = data.managing_user_group == null ? data.managing_user_group : {
      id: data.managing_user_group.id,
      title: localizedTitle(data.managing_user_group.title),
      status: data.managing_user_group.status,
    };
    /** @type {string|undefined} */
    this.name = data.name;
    this.description = data.description;
    this.avatar_id = data.avatar_id;
    this.banner_id = data.banner_id;
    this.default_role_id = data.default_role_id;
    // Role fields are sample-derived, not a complete role API contract.
    const role = data.default_role;
    this.default_role = role == null ? role : {
      id: role.id,
      title: localizedTitle(role.title),
      type: role.type,
      predefined_role_type: role.predefined_role_type,
      scope: role.scope,
      permission_count: role.permission_count,
      actions: actionPermissions(role.actions, ["edit", "delete", "reset"]),
    };
    if (role?.actions?.edit != null) {
      Object.assign(this.default_role.actions.edit,
        actionPermissions(role.actions.edit, ["localizations", "permissions", "external_id"]));
    }
    this.created_at = data.created_at;
    /** Total members, including indirect membership. @type {number|undefined} */
    this.member_count = data.member_count;
    /** @type {'ACTIVE'|'ARCHIVED'|undefined} */
    this.channel_state = data.channel_state;
    const settings = data.channel_settings;
    this.channel_settings = settings == null ? settings : {
      reactions_enabled: settings.reactions_enabled,
      comments_enabled: settings.comments_enabled,
      show_download_button_for_media: settings.show_download_button_for_media,
      show_download_button_for_pdf: settings.show_download_button_for_pdf,
      show_posts_in_newsfeed: settings.show_posts_in_newsfeed,
      hide_member_list: settings.hide_member_list,
      allow_members_to_leave_and_join: settings.allow_members_to_leave_and_join,
      members_can_publish: settings.members_can_publish,
      posting_needs_approval_enabled: settings.posting_needs_approval_enabled,
    };
    this.actions = actionPermissions(data.actions, CHANNEL_ACTIONS);
    /** @type {'MEMBER'|'ADMIN'|undefined} */
    this.actor_role = data.actor_role;
  }

  /** Retrieve one admin channel with optional embeds and Accept-Language. */
  static async getById(channelId, params = {}, { acceptLanguage } = {}) {
    if (typeof channelId !== "string" || !channelId.trim()) {
      throw Object.assign(new Error("channel_id is required."), { statusCode: 400 });
    }
    const query = {};
    if (params.embed !== undefined) {
      const embeds = Array.isArray(params.embed) ? params.embed : [params.embed];
      if (embeds.some(embed => !EMBEDS.includes(embed))) {
        throw Object.assign(new Error("Invalid channel embed."), { statusCode: 400 });
      }
      query.embed = embeds;
    }
    const response = await flipAxios.get(`/api/admin/channels/v4/channels/${encodeURIComponent(channelId)}`, {
      params: query,
      // Repeated keys follow the posts convention; live encoding remains unverified.
      paramsSerializer: { indexes: null },
      ...(acceptLanguage && { headers: { "Accept-Language": acceptLanguage } }),
    });
    if (typeof response.data?.channel_id !== "string" || typeof response.data?.name !== "string") {
      throw Object.assign(new Error("Unexpected Flip channel response shape."), { statusCode: 502 });
    }
    return new FlipChannel(response.data);
  }
}

module.exports = FlipChannel;

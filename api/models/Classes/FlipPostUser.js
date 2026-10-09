/** Posts v4 user summary for authors and survey voters.
 * Separate from FlipUser, which maps the User Admin API into employee fields.
 */
class FlipPostUser {
  constructor(data = {}) {
    /** @type {string|undefined} */
    this.id = data.id;
    /** @type {string|undefined} */
    this.external_id = data.external_id;
    /** @type {boolean|undefined} */
    this.is_deleted = data.is_deleted;
    /** @type {string|undefined} */
    this.first_name = data.first_name;
    /** @type {string|undefined} */
    this.last_name = data.last_name;
    /** @type {string|undefined} */
    this.department = data.department;
    /** @type {{file_id: string}|null|undefined} */
    this.profile_picture = data.profile_picture == null ? data.profile_picture : {
      file_id: data.profile_picture.file_id,
    };
    /** @type {'REGULAR'|'MANAGEMENT'|'API'|'SYSTEM'|undefined} */
    this.user_type = data.user_type;
  }
}

module.exports = FlipPostUser;

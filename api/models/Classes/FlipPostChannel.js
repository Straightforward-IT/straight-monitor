/** Channel summary embedded by Posts v4; distinct from the Admin Channels API. */
class FlipPostChannel {
  constructor(data = {}) {
    /** @type {string|undefined} */
    this.id = data.id;
    /** @type {string|undefined} */
    this.external_id = data.external_id;
    /** @type {string|undefined} */
    this.name = data.name;
    this.settings = data.settings == null ? data.settings : {
      show_download_button_for_pdf: data.settings.show_download_button_for_pdf,
      show_download_button_for_media: data.settings.show_download_button_for_media,
    };
  }
}

module.exports = FlipPostChannel;

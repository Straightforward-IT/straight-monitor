const FlipPostUser = require("./FlipPostUser");

/** Manual survey question/choice translation. */
class FlipPostLocalizedText {
  constructor(data = {}) {
    this.language = data.language;
    this.detected_language = data.detected_language;
    this.text = data.text;
    /** @type {boolean|undefined} */
    this.primary = data.primary;
  }
}

/** Vote details appear only when returned by the upstream API. */
class FlipPostSurveyVote {
  constructor(data = {}) {
    /** @type {FlipPostUser|null|undefined} */
    this.user = data.user == null ? data.user : new FlipPostUser(data.user);
    this.voted_at = data.voted_at;
  }
}

class FlipPostSurveyChoice {
  constructor(data = {}) {
    this.id = data.id;
    this.title = data.title;
    this.language = data.language;
    this.detected_language = data.detected_language;
    /** @type {boolean|undefined} */
    this.auto_translated = data.auto_translated;
    /** @type {FlipPostLocalizedText[]|null|undefined} */
    this.title_i18n = data.title_i18n == null ? data.title_i18n : data.title_i18n.map(item => new FlipPostLocalizedText(item));
    /** @type {boolean|undefined} */
    this.checked = data.checked;
    /** @type {number|undefined} */
    this.vote_count_percentage = data.vote_count_percentage;
    /** @type {number|undefined} */
    this.vote_count_absolute = data.vote_count_absolute;
    /** @type {FlipPostSurveyVote[]|null|undefined} */
    this.votes = data.votes == null ? data.votes : data.votes.map(item => new FlipPostSurveyVote(item));
    /** @type {FlipPostUser[]|null|undefined} */
    this.last_voters = data.last_voters == null ? data.last_voters : data.last_voters.map(item => new FlipPostUser(item));
  }
}

/** Multilingual survey with actor-specific choices and upstream visibility. */
class FlipPostSurvey {
  constructor(data = {}) {
    this.id = data.id;
    /** @type {'SINGLE_CHOICE'|'MULTIPLE_CHOICE'|undefined} */
    this.type = data.type;
    /** @type {FlipPostSurveyChoice[]|null|undefined} */
    this.choices = data.choices == null ? data.choices : data.choices.map(item => new FlipPostSurveyChoice(item));
    this.end_date = data.end_date;
    /** @type {'ANONYMOUS'|'NON_ANONYMOUS'|'NON_ANONYMOUS_AUTHOR_ADMIN'|undefined} */
    this.anonymity = data.anonymity;
    this.question = data.question;
    this.language = data.language;
    this.detected_language = data.detected_language;
    /** @type {boolean|undefined} */
    this.auto_translated = data.auto_translated;
    /** @type {FlipPostLocalizedText[]|null|undefined} */
    this.question_i18n = data.question_i18n == null ? data.question_i18n : data.question_i18n.map(item => new FlipPostLocalizedText(item));
  }
}

module.exports = FlipPostSurvey;

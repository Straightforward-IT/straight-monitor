const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { flipAxios } = require('../services/integrations/flipAxios');
const FlipPost = require('../models/Classes/FlipPost');
const FlipPostContent = require('../models/Classes/FlipPostContent');
const FlipPostUser = require('../models/Classes/FlipPostUser');
const FlipPostAttachment = require('../models/Classes/FlipPostAttachment');
const FlipPostSurvey = require('../models/Classes/FlipPostSurvey');
const servicePath = require.resolve('../services/integrations/FlipService');
const previousService = require.cache[servicePath];
require.cache[servicePath] = { exports: { getFlipPosts: (...args) => FlipPost.list(...args) } };
const router = require('../routes/integrations/flipPostRoutes');
if (previousService) require.cache[servicePath] = previousService;
else delete require.cache[servicePath];
function request(query = {}, token, language) {
  return new Promise((resolve, reject) => {
    const req = { query, header: () => token, get: () => language };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); } };
    const handlers = router.stack[0].route.stack;
    let index = 0;
    const next = error => error ? reject(error) : handlers[index++].handle(req, res, next);
    next();
  });
}
describe('Flip Posts v4', () => {
  let originalGet, secret, calls, response;
  beforeEach(() => {
    originalGet = flipAxios.get;
    secret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'flip-posts-test';
    calls = [];
    response = { posts: [], pagination: { has_more: false, next_cursor: null } };
    flipAxios.get = async (path, config) => { calls.push({ path, config }); return { data: response }; };
  });
  afterEach(() => {
    flipAxios.get = originalGet;
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
  });
  it('round-trips every documented post field through explicit nested models', async () => {
    const user = { id: 'user', external_id: 'employee', is_deleted: false,
      first_name: 'Anna', last_name: 'Test', department: 'Service',
      profile_picture: { file_id: 'avatar' }, user_type: 'REGULAR' };
    const attachment = { id: 'video', filename: 'video.mp4', link: '/media/video', mime_type: 'video/mp4',
      category: 'VIDEO', meta_data: { width: 1920, height: 1080, size: 0 }, source: 'EXT_API', media_token: 'test-token',
      variants: [{ id: 'variant', attachment_id: 'video', variant: 'ORIGINAL', status: 'READY',
        location: '/media/variant', mime_type: 'video/mp4', size: 0, file_name: 'video.mp4' }] };
    const localized = { language: 'de-DE', detected_language: 'de-DE', text: 'Ja', primary: true };
    const timestamp = '2026-10-08T10:00:00Z';
    const payload = {
      id: 'post', external_id: 'external', channel_id: 'channel',
      channel: { id: 'channel', external_id: 'news', name: 'News',
        settings: { show_download_button_for_pdf: false, show_download_button_for_media: true } },
      author_id: 'user', author: user,
      info: { published_at: timestamp, scheduled_at: null, archived_at: null, highlighted_until: timestamp,
        highlighted_at: timestamp, created_at: timestamp, updated_at: timestamp, status: 'PUBLISHED' },
      available_languages: [{ locale: 'de-DE', primary: true }, { locale: 'en-GB', primary: false }],
      content: [{ language: 'de-DE', detected_language: 'de-DE', auto_translated: false, primary_language: true,
        title: 'News', body: { format: 'HTML', value: '<p>News</p>' }, edited_at: timestamp,
        header_attachment_ids: ['video'], inline_attachment_ids: ['video'], standard_attachment_ids: ['video'],
        header_attachments: [attachment], inline_attachments: [attachment], standard_attachments: [attachment] }],
      header_attachment_ids: ['video'], standard_attachment_ids: ['video'],
      header_attachments: [attachment], standard_attachments: [attachment],
      reactions_summary: { total: 0, items: [{ count: 0, icon: 'heart', type: 'UNICODE', unicode_reaction: '♥', by_actor: false }] },
      comments_summary: { total: 0 }, settings: { reactions_enabled: false, comments_enabled: true },
      livestream_id: 'stream', mentions: [{ mentioned_user_id: 'user', mention_name: 'Anna', user_is_deleted: false }],
      surveys: [{ id: 'survey', type: 'SINGLE_CHOICE', end_date: timestamp, anonymity: 'NON_ANONYMOUS',
        question: 'Teilnehmen?', language: 'de-DE', detected_language: 'de-DE', auto_translated: false,
        question_i18n: [{ ...localized, text: 'Teilnehmen?' }],
        choices: [{ id: 'choice', title: 'Ja', language: 'de-DE', detected_language: 'de-DE', auto_translated: false,
          title_i18n: [localized], checked: false, vote_count_percentage: 0, vote_count_absolute: 0,
          votes: [{ user, voted_at: timestamp }], last_voters: [user] }] }],
      bookmarked: false, views_count: null,
    };
    response = { posts: [payload], pagination: { next_cursor: null, has_more: false } };
    const result = await FlipPost.list();
    assert.deepEqual(JSON.parse(JSON.stringify(result)), response);
    const post = result.posts[0];
    assert.ok(post.author instanceof FlipPostUser);
    assert.ok(post.header_attachments[0] instanceof FlipPostAttachment);
    assert.ok(post.content[0].inline_attachments[0] instanceof FlipPostAttachment);
    assert.ok(post.surveys[0] instanceof FlipPostSurvey);
    assert.ok(post.surveys[0].choices[0].votes[0].user instanceof FlipPostUser);
    assert.ok(post.surveys[0].choices[0].last_voters[0] instanceof FlipPostUser);
  });
  it('does not manufacture nested embeds or survey voter data', () => {
    const payload = { id: 'post', channel_id: 'channel', author_id: 'author', info: null, settings: null,
      author: null, available_languages: null, header_attachments: null, standard_attachments: [],
      reactions_summary: null, comments_summary: null, mentions: [],
      surveys: [{ id: 'survey', anonymity: 'ANONYMOUS', choices: [{ id: 'choice', checked: false,
        votes: null, last_voters: [], title_i18n: null }], question_i18n: [] }] };
    assert.deepEqual(JSON.parse(JSON.stringify(new FlipPost(payload))), payload);
    assert.equal(new FlipPost({ info: {}, settings: {} }).surveys, undefined);
  });
  it('preserves nested content, surveys, false, zero and missing embeds', () => {
    const payload = { id: 'p', channel_id: 'c', author_id: 'a', info: { status: 'DRAFT' },
      settings: { comments_enabled: false }, content: [{ language: 'de-DE', auto_translated: false,
        body: { format: 'DELTA', value: '{"ops":[]}' }, inline_attachments: [{ variants: [{ status: 'PENDING' }] }] }],
      surveys: [{ anonymity: 'ANONYMOUS', choices: [{ checked: false, votes: [] }] }], bookmarked: false, views_count: 0 };
    const post = new FlipPost(payload);
    assert.ok(post.content[0] instanceof FlipPostContent);
    assert.deepEqual(JSON.parse(JSON.stringify(post)), payload);
    assert.equal(new FlipPost({ views_count: null }).views_count, null);
    assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(new FlipPost())), 'author'), false);
  });
  it('keeps language variants distinct and preserves empty titles, formatted bodies and attachment references', () => {
    const content = [
      { language: 'de-DE', detected_language: 'de-DE', auto_translated: false, primary_language: true,
        title: '', body: { format: 'HTML', value: '<p>Hallo</p>' }, edited_at: '2026-10-08T10:00:00Z',
        header_attachment_ids: ['header'], inline_attachment_ids: ['inline'], standard_attachment_ids: ['file'],
        header_attachments: [], inline_attachments: [], standard_attachments: [] },
      { language: 'en-GB', auto_translated: true, primary_language: false,
        title: 'Hello', body: { format: 'PLAIN', value: '' } },
    ];
    const post = new FlipPost({ content });
    assert.deepEqual(JSON.parse(JSON.stringify(post.content)), content);
    assert.equal(post.content.find(item => item.language === 'en-GB').title, 'Hello');
    assert.equal(post.content[1].primary_language, false);
    assert.equal(new FlipPost().content, undefined);
    assert.equal(new FlipPost({ content: null }).content, null);
    assert.deepEqual(new FlipPost({ content: [] }).content, []);
  });
  it('forwards filters, repeated array keys, cursor and language with pagination', async () => {
    response = { posts: [{ id: 'p' }], pagination: { has_more: true, next_cursor: 'next' } };
    const result = await FlipPost.list({ channel_id: ['a', 'b'], status: 'PUBLISHED', embed: ['AUTHOR', 'CHANNEL'],
      only_highlighted: 'false', page_limit: '25', page_cursor: 'current', target_language: '*' }, { acceptLanguage: 'de-DE' });
    assert.ok(result.posts[0] instanceof FlipPost);
    assert.deepEqual(result.pagination, response.pagination);
    assert.equal(calls[0].path, '/api/posts/v4/posts');
    assert.equal(calls[0].config.params.page_limit, 25);
    assert.equal(calls[0].config.params.only_highlighted, false);
    assert.equal(calls[0].config.params.page_cursor, 'current');
    assert.equal(calls[0].config.headers['Accept-Language'], 'de-DE');
    const url = axios.getUri({ url: calls[0].path, ...calls[0].config });
    assert.deepEqual(new URL(url, 'https://example.test').searchParams.getAll('channel_id'), ['a', 'b']);
  });
  it('rejects invalid filters before contacting Flip and allows inclusive date boundaries', async () => {
    for (const params of [{ status: 'DRAFT' }, { embed: 'UNKNOWN' }, { content_format: 'XML' },
      { page_limit: '1.5' }, { page_limit: [] }, { page_limit: ['25'] }, { author_id: { value: 'a' } },
      { only_highlighted: 'yes' }, { only_newsfeed: 'true', channel_id: 'a' },
      { only_newsfeed: true, only_schedulable_channels: true }, { date_from: '2026-10-01' },
      { status: 'ARCHIVED', date_from: '2026-10-01' }, { status: 'PUBLISHED', date_from: 'invalid' },
      { status: 'PUBLISHED', date_from: '2026-10-08', date_to: '2026-10-01' }]) {
      await assert.rejects(() => FlipPost.list(params), error => error.statusCode === 400);
    }
    assert.equal(calls.length, 0);
    await FlipPost.list({ status: ['PUBLISHED', 'SCHEDULED'], date_from: '2026-10-01', date_to: '2026-10-01' });
  });
  it('rejects malformed responses and missing continuation cursors', async () => {
    for (const data of [{}, { posts: [], pagination: {} }, { posts: [], pagination: { has_more: true } }]) {
      response = data;
      await assert.rejects(() => FlipPost.list(), error => error.statusCode === 502);
    }
  });
  it('authenticates requests, forwards language, and handles errors without leaking upstream data', async () => {
    assert.equal((await request()).status, 401);
    assert.equal((await request({}, 'invalid')).status, 401);
    assert.equal(calls.length, 0);
    const token = jwt.sign({ user: { id: 'user' } }, process.env.JWT_SECRET);
    assert.equal((await request({ status: 'DRAFT' }, token)).status, 400);
    assert.equal((await request({ page_limit: '10' }, token, 'de-DE')).status, 200);
    assert.equal(calls[0].config.headers['Accept-Language'], 'de-DE');
    flipAxios.get = async () => { throw new Error('private upstream data'); };
    const failed = await request({}, token);
    assert.equal(failed.status, 502);
    assert.ok(!failed.body.message.includes('private'));
  });
});

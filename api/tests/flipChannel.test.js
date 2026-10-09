const assert = require('node:assert/strict');
const { flipAxios } = require('../services/integrations/flipAxios');
const FlipChannel = require('../models/Classes/FlipChannel');
const FlipPostChannel = require('../models/Classes/FlipPostChannel');
const FlipPost = require('../models/Classes/FlipPost');

describe('Flip channel models', () => {
  let originalGet;
  beforeEach(() => { originalGet = flipAxios.get; });
  afterEach(() => { flipAxios.get = originalGet; });

  it('distinguishes a post summary from an admin channel and preserves missing embeds', () => {
    const summary = { id: 'channel', external_id: 'external', name: 'News',
      settings: { show_download_button_for_pdf: false, show_download_button_for_media: true } };
    const post = new FlipPost({ channel: summary });
    assert.ok(post.channel instanceof FlipPostChannel);
    assert.deepEqual(JSON.parse(JSON.stringify(post.channel)), summary);
    assert.equal(post.channel.channel_settings, undefined);
    assert.equal(new FlipPost().channel, undefined);
    assert.equal(new FlipPost({ channel: null }).channel, null);
    const channel = new FlipChannel({ channel_id: 'channel', name: 'News', member_count: 0 });
    assert.equal(channel.member_count, 0);
    assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(channel)), 'actions'), false);
  });

  it('retrieves an encoded primary ID with embeds and language, retaining nested permissions', async () => {
    const payload = { channel_id: 'channel/id', name: 'News', channel_state: 'ACTIVE', member_count: 0,
      channel_settings: { members_can_publish: false, posting_needs_approval_enabled: true },
      managing_user_group: { id: 'group', title: { language: 'de-DE', text: 'Team' }, status: 'ACTIVE' },
      default_role: { id: 'role', title: { language: 'en-GB', text: 'Owner' }, permission_count: 0,
        actions: { edit: { allowed: false, localizations: { allowed: false },
          permissions: { allowed: true }, external_id: { allowed: false } }, delete: { allowed: false } } },
      actions: { edit: { allowed: false }, view: { allowed: true } }, actor_role: 'MEMBER' };
    flipAxios.get = async (path, config) => {
      assert.equal(path, '/api/admin/channels/v4/channels/channel%2Fid');
      assert.deepEqual(config.params.embed, ['ACTIONS', 'DEFAULT_ROLE']);
      assert.equal(config.headers['Accept-Language'], 'de-DE');
      return { data: payload };
    };
    const channel = await FlipChannel.getById('channel/id', { embed: ['ACTIONS', 'DEFAULT_ROLE'] }, { acceptLanguage: 'de-DE' });
    assert.ok(channel instanceof FlipChannel);
    assert.deepEqual(JSON.parse(JSON.stringify(channel)), payload);
  });

  it('rejects missing IDs and unsupported embeds before making requests, and malformed responses', async () => {
    let calls = 0;
    flipAxios.get = async () => { calls++; return { data: [] }; };
    await assert.rejects(() => FlipChannel.getById(''), error => error.statusCode === 400);
    await assert.rejects(() => FlipChannel.getById('id', { embed: 'AUTHOR' }), error => error.statusCode === 400);
    assert.equal(calls, 0);
    await assert.rejects(() => FlipChannel.getById('id'), error => error.statusCode === 502);
  });
});

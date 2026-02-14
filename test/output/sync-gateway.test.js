 
import to from 'to-js';
import default_options from '../../app/output/default-options';

jest.mock('request', () => {
  const req = jest.requireActual('request');
  const mockRequest = (options, callback) => {
    callback(null, { headers: { 'set-cookie': true } }, { ok: true });
  };
  return Object.assign(mockRequest, req);
});

import SyncGateway, { request } from '../../app/output/sync-gateway';

describe('output:sync-gateway', () => {
  let context;

  beforeEach(() => {
    context = new SyncGateway();
  });

  test('without args', () => {
    expect(context.output_options).toEqual(default_options);
    expect(context.prepared).toBe(false);
    expect(typeof context.prepare).toBe('function');
    expect(typeof context.output).toBe('function');
  });

  describe('prepare', () => {
    test('no username and password', async () => {
      context.output_options.bucket = 'prepare';
      expect(context.prepared).toBe(false);
      expect(context.preparing).toBe(undefined);
      const preparing = context.prepare();
      expect(typeof context.preparing.then).toBe('function');
      expect(context.prepared).toBe(false);
      await preparing;
      await new Promise((resolve) => setImmediate(resolve));
      expect(context.prepared).toBe(true);
    });
  });

  describe('setup', () => {
    test('no username and password', async () => {
      context.output_options.bucket = 'setup';
      expect(context.prepared).toBe(false);
      expect(context.preparing).toBe(undefined);
      const preparing = context.setup();
      expect(typeof context.preparing.then).toBe('function');
      expect(context.prepared).toBe(false);
      await preparing;      await new Promise((resolve) => setImmediate(resolve));      await new Promise((resolve) => setImmediate(resolve));
      expect(context.prepared).toBe(true);
    });

    // NO IDEA HOW THE HELL TO WRITE UNIT TESTS FOR THIS CRAP
    test.skip('authentication', async () => {
      context.output_options.bucket = 'setup';
      context.output_options.username = 'Administrator';
      context.output_options.password = 'password';
      expect(context.prepared).toBe(false);
      expect(context.preparing).toBe(undefined);
      const preparing = context.setup();
      expect(typeof context.preparing.then).toBe('function');
      expect(context.prepared).toBe(false);
      await preparing;
      expect(context.prepared).toBe(true);
    });
  });

  describe('output', () => {
    // currently can't test this
    test.todo('output test');
  });

  // this is just calling another library and it's just converting
  // it's callback style to a promise style so we just need to ensure
  // it's a promise.
  test('request', async () => {
    let actual = request('localhost:3000');
    expect(typeof actual.then).toBe('function');
    actual = await actual;
    expect(to.type(actual)).toBe('array');
    expect(to.type(actual[0])).toBe('object');
    expect(to.type(actual[1])).toBe('object');
  });
});

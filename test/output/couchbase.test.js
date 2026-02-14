jest.mock('couchbase-promises', () => {
  class MockBucket {
    constructor() {
      this._store = {};
      this.operationTimeout = 5000;
    }
    upsertAsync(id, data) {
      this._store[id] = data;
      return Promise.resolve();
    }
    getAsync(id) {
      return Promise.resolve({ value: this._store[id] });
    }
    disconnect() {
      return Promise.resolve();
    }
  }

  class MockCluster {
    constructor() {
      this._buckets = {};
    }
    authenticate() {}
    openBucket(name, callback) {
      if (!this._buckets[name]) {
        this._buckets[name] = new MockBucket();
      }
      const bucket = this._buckets[name];
      process.nextTick(() => {
        callback(null);
      });
      return bucket;
    }
  }

  const mock = { Cluster: MockCluster, Mock: { Cluster: MockCluster } };
  mock.default = mock;
  return mock;
});

import Couchbase from '../../app/output/couchbase';
import couchbase from 'couchbase-promises';
import default_options from '../../app/output/default-options';
import to from 'to-js';

describe('output:couchbase', () => {
  let context;

  beforeEach(() => {
    context = new Couchbase();
    // this replaces the original cluster with the mock cluster that doesn't require
    // an actual server to be running, this way it's easy to test the functionality
    // of our functions and not couchbases functions.
    context.cluster = new couchbase.Mock.Cluster(context.output_options.server);
  });

  test('without args', () => {
    expect(context.output_options).toEqual(default_options);
    expect(context.prepared).toBe(false);
    expect(typeof context.prepare).toBe('function');
    expect(typeof context.output).toBe('function');
    expect(context.cluster.constructor.name).toBe('MockCluster');
  });

  test('prepare', async () => {
    expect(context.prepared).toBe(false);
    expect(context.preparing).toBe(undefined);
    const preparing = context.prepare();
    expect(typeof context.preparing.then).toBe('function');
    expect(context.prepared).toBe(false);
    await preparing;
    expect(context.prepared).toBe(true);
    expect(to.type(context.bucket)).toBe('object');
    expect(context.bucket.connected).toBe(true);
  });

  describe('setup', () => {
    test('setup', async () => {
      expect(context.prepared).toBe(false);
      expect(context.preparing).toBe(undefined);
      const preparing = context.setup();
      expect(typeof context.preparing.then).toBe('function');
      expect(context.prepared).toBe(false);
      expect(await preparing).toBeFalsy();
      expect(context.prepared).toBe(true);
      expect(to.type(context.bucket)).toBe('object');
      expect(context.bucket.connected).toBe(true);
    });
  });

  describe('output', () => {
    const languages = {
      cson: to.normalize(`
      [
        {
          id: 302672
          code: "AD"
          name: "Andorra"
          continent: "EU"
        }
        {
          id: 302618
          code: "AE"
          name: "United Arab Emirates"
          continent: "AS"
        }
      ]
    `),
      csv: to.normalize(`
      id,code,name,continent
      302672,AD,Andorra,EU
      302618,AE,United Arab Emirates,AS
      302619,AF,Afghanistan,AS
      302722,AG,Antigua and Barbuda,NA
      302723,AI,Anguilla,NA
      302673,AL,Albania,EU
      302620,AM,Armenia,AS
      302556,AO,Angola,AF
      302615,AQ,Antarctica,AN
      302789,AR,Argentina,SA
      302763,AS,American Samoa,OC
      302674,AT,Austria,EU
      302764,AU,Australia,OC
      302725,AW,Aruba,NA
      302621,AZ,Azerbaijan,AS
      302675,BA,Bosnia and Herzegovina,EU
    `),
      json: to.json([
        {
          id: 302672,
          code: 'AD',
          name: 'Andorra',
          continent: 'EU'
        },
        {
          id: 302618,
          code: 'AE',
          name: 'United Arab Emirates',
          continent: 'AS'
        },
      ]),
      yaml: to.normalize(`
      -
        id: 302672
        code: AD
        name: Andorra
        continent: EU
      -
        id: 302618
        code: AE
        name: 'United Arab Emirates'
        continent: AS
      -
        id: 302619
        code: AF
        name: Afghanistan
        continent: AS
    `)
    };

    for (let language of to.keys(languages)) {
      const data = languages[language];
      test(language, async () => {
        context.output_options.bucket = `output-${language}`;
        const id = `1234567890-${language}`;
        context.output_options.format = language;
        await context.output(id, data);
        const document = await context.bucket.getAsync(id);
        expect(document).not.toBe(null);
        expect(document.value).toEqual(data);
      });
    }

    test('prepare has started but isn\'t complete', async () => {
      const language = 'json';
      const data = languages[language];
      context.output_options.bucket = `output-${language}`;
      const id = `1234567890-${language}`;
      context.output_options.format = language;
      context.prepare();
      await context.output(id, data);
      const document = await context.bucket.getAsync(id);
      expect(document).not.toBe(null);
      expect(document.value).toEqual(data);
    });
  });

  describe('finalize', () => {
    test('do nothing because prepare wasn\'t called before finalize', async () => {
      await context.finalize();
      expect(context.bucket).toBe(undefined);
      expect(context.prepared).toBe(false);
      expect(context.preparing).toBe(undefined);
    });

    test('disconnected', async () => {
      context.output_options.bucket = 'finalize';
      await context.prepare();
      expect(to.type(context.bucket)).toBe('object');
      expect(context.prepared).toBe(true);
      expect(typeof context.preparing.then).toBe('function');
      expect(context.bucket.connected).toBe(true);
      await context.finalize();
      expect(to.type(context.bucket)).toBe('object');
      expect(context.prepared).toBe(true);
      expect(typeof context.preparing.then).toBe('function');
      expect(context.bucket.connected).toBe(false);
    });
  });
});

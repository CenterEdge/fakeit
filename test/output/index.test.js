import Output, { validate, isServer, isString, output_types } from '../../app/output/index';
import { join as p } from 'path';
import { describe, expect, it, beforeEach, test } from '@jest/globals';
import { stripColor } from 'chalk';
import fs from 'fs-extra-promisify';
import { map, reduce } from 'async-array-methods';
import globby from 'globby';
import to from 'to-js';
import { startCapturing, stopCapturing } from '../console';
import { fail } from 'assert';

const output_root = p(__dirname, '..', 'fixtures', 'output');

describe('output:', () => {
  let context;

  beforeEach(() => {
    context = new Output({ root: output_root });
  });

  it('without args', () => {
    expect(context.options).toEqual({
      root: output_root,
      log: true,
      verbose: false,
      spinners: true,
      timestamp: true
    });
    expect(context.log_types).toBeTruthy();
    expect(context.output_options).toEqual({
      format: 'json',
      spacing: 2,
      archive: '',
      output: 'return',
      limit: 10,
      highlight: true,
      server: 'couchbase://127.0.0.1',
      bucket: 'default',
      password: '',
      username: '',
      timeout: 5000,
    });
  });

  it('output_types', () => {
    expect(output_types).toEqual([ 'return', 'console', 'couchbase', 'sync-gateway' ]);
  });

  describe('validation', () => {
    describe('format', () => {
      const passing = [ 'json', 'csv', 'yaml', 'yml', 'cson' ];
      test.each(passing)('passing %p', (format) => {
        context.output_options.format = format;
        expect(() => {
          validate.format(format);
          context.validateOutputOptions();
        }).not.toThrow();
      });
      const failing = [ 'jpg', 'jpeg', 'js', 'ai', 'psd' ];
      test.each(failing)('failing %p', (format) => {
        context.output_options.format = format;
        const validateFormat = () => validate.format(format);
          expect(validateFormat).toThrow();
          expect(() => context.validateOutputOptions()).toThrow();
      });
    });

    describe('spacing', () => {
      const passing = [ 0, 1, 2, 3, 4, 5, 6, 7, 8 ];
      test.each(passing, 'passing %p', (spacing) => {
        context.output_options.spacing = spacing;
        expect(() => {
          validate.spacing(spacing);
          context.validateOutputOptions();
        }).not.toThrow();
      });
      const failing = [ '', [], {} ];
      test.each(failing, 'failing %p', (spacing) => {
        context.output_options.spacing = spacing;
        const validateSpacing = () => validate.spacing(spacing);
          expect(validateSpacing).toThrow();
          expect(() => context.validateOutputOptions()).toThrow();
      });
    });

    describe('output', () => {
      const passing = [ 'return', 'console', 'couchbase', 'sync-gateway', 'output/folder' ];
      test.each(passing)('passing %p', (output) => {
        if (output === 'sync-gateway') {
          context.output_options.username = 'tyler';
          context.output_options.password = 'password';
        } else if (output === 'couchbase') {
          context.output_options.password = 'password';
        }
        context.output_options.output = output;
        expect(() => {
          validate.output(output);
          context.validateOutputOptions();
        }).not.toThrow();
      });
      const failing = [ 'outputfile.zip', 2, '', [], {} ];
      test.each(failing)('failing %p', (output) => {
        context.output_options.output = output;
        const validateOutput = () => validate.output(output);
        expect(validateOutput).toThrow();
        expect(() => context.validateOutputOptions()).toThrow();
      });
    });

    describe('limit', () => {
      const passing = [ 100, 200, 300, 400, 500, 600, 700, 800 ];
      test.each(passing)('passing %p', (limit) => {
        context.output_options.limit = limit;
        expect(() => {
          validate.limit(limit);
          context.validateOutputOptions();
        }).not.toThrow();
      });
      const failing = [ '', [], {} ];
      test.each(failing)('failing %p', (limit) => {
        context.output_options.limit = limit;
        const validateLimit = () => validate.limit(limit);
        expect(validateLimit).toThrow();
        expect(() => context.validateOutputOptions()).toThrow();
      });
    });

    describe('highlight', () => {
      const passing = [ true, false ];
      test.each(passing)('passing %p', (highlight) => {
        context.output_options.highlight = highlight;
        expect(() => {
          validate.highlight(highlight);
          context.validateOutputOptions();
        }).not.toThrow();
      });
      const failing = [ 2, '', [], {} ];
      test.each(failing)('failing %p', (highlight) => {
        context.output_options.highlight = highlight;
        const validateHighlight = () => validate.highlight(highlight);
        expect(validateHighlight).toThrow();
        expect(() => context.validateOutputOptions()).toThrow();
      });
    });

    describe('archive', () => {
      const passing = [ 'one.zip', '' ];
      test.each(passing)('passing %p', (archive) => {
        context.output_options.output = 'somefolder';
        context.output_options.archive = archive;
        expect(() => {
          validate.archive(archive, context.output_options);
          context.validateOutputOptions();
        }).not.toThrow();
      });

      it('passing output is return', () => {
        context.output_options.archive = '';
        expect(() => {
          validate.archive(context.output_options.archive, context.output_options);
          context.validateOutputOptions();
        }).not.toThrow();
      });

      it('passing output is console', () => {
        context.output_options.output = 'console';
        context.output_options.archive = '';
        expect(() => {
          validate.archive(context.output_options.archive, context.output_options);
          context.validateOutputOptions();
        }).not.toThrow();
      });

      const failing = [ true, false, 2, [], {} ];
      test.each(failing)('failing %p', (archive) => {
        context.output_options.archive = archive;
        const validateArchive = () => validate.archive(archive);
        expect(validateArchive).toThrow();
        expect(() => context.validateOutputOptions()).toThrow();
      });

      it('failing output is return', () => {
        context.output_options.archive = 'somefile.zip';
        const validateArchive = () => validate.archive(context.output_options.archive, context.output_options);
        expect(validateArchive).toThrow();
        expect(() => context.validateOutputOptions()).toThrow();
      });

      it('failing output because `archive` isn\'t a `.zip` file', () => {
        context.output_options.archive = 'somefile.woohoo';
        context.output_options.output = 'somefolder';
        const validateArchive = () => validate.archive(context.output_options.archive, context.output_options);
        const validateOutputOptions = () => context.validateOutputOptions();
        startCapturing();
        expect(validateArchive).toThrow();
        expect(validateOutputOptions).toThrow();
        const consoleOutput = stopCapturing();
      });

      it('failing output is console', () => {
        context.output_options.output = 'console';
        context.output_options.archive = 'somefile.zip';
        const validateArchive = () => validate.archive(context.output_options.archive, context.output_options);
        expect(validateArchive).toThrow();
        expect(() => context.validateOutputOptions()).toThrow();
      });

      it('failing output a string wasn\'t passed as the option', () => {
        context.output_options.output = 'test-folder';
        context.output_options.archive = [];
        const validateArchive = () => validate.archive(context.output_options.archive, context.output_options);
        expect(validateArchive).toThrow();
        expect(() => context.validateOutputOptions()).toThrow();
      });
    });

    describe('server', () => {
      const passing = [ '127.0.0.1', '127.0.0.1:8080', 'http://localhost:3000' ];
      const servers = [ 'sync-gateway', 'couchbase', 'sync-gateway', 'couchbase' ];
      passing.forEach((server, i) => {
        it(`passing ${server}`, () => {
          if (server !== 'couchbase') {
            context.output_options.username = 'tyler';
          }
          context.output_options.password = 'password';
          context.output_options.output = servers[i];
          context.output_options.server = server;
          expect(() => {
            validate.server(server, context.output_options);
            context.validateOutputOptions();
          }).not.toThrow();
        });
      });

      const failing = [ 2, '', [], {} ];
      failing.forEach((server, i) => {
        it(`failing ${server}`, () => {
          if (server !== 'couchbase') {
            context.output_options.username = 'tyler';
          }
          context.output_options.password = 'password';
          context.output_options.output = servers[i];
          context.output_options.server = server;
          const validateServer = () => validate.server(server, context.output_options);
          expect(validateServer).toThrow();
          expect(() => context.validateOutputOptions()).toThrow();
        });
      });

      it('failing archive is true and output is couchbase', () => {
        context.output_options.output = 'couchbase';
        context.output_options.archive = true;
        context.output_options.server = '127.0.0.1';

        const validateServer = () => validate.server(context.output_options.server, context.output_options);
        expect(validateServer).toThrow();
        expect(() => context.validateOutputOptions()).toThrow();
      });

      it('failing archive is true and output is sync-gateway', () => {
        context.output_options.output = 'sync-gateway';
        context.output_options.archive = true;
        context.output_options.server = '127.0.0.1';
        const validateServer = () => validate.server(context.output_options.server, context.output_options);
        expect(validateServer).toThrow();
        expect(() => context.validateOutputOptions()).toThrow();
      });
    });

    describe('bucket', () => {
      const passing = [ 'asdfasdfasdf', 'asdfasdfsadf', 'asfasdfasdfasdfasdf' ];
      const servers = [ 'sync-gateway', 'couchbase', 'sync-gateway', 'couchbase' ];
      passing.forEach((bucket, i) => {
        it(`passing ${bucket}`, () => {
          context.output_options.username = 'tyler';
          context.output_options.password = 'password';
          context.output_options.output = servers[i];
          context.output_options.bucket = bucket;
          expect(() => {
            validate.bucket(bucket, context.output_options);
            context.validateOutputOptions();
          }).not.toThrow();
        });
      });

      const failing = [ 2, '', [], {} ];
      failing.forEach((bucket, i) => {
        it(`failing ${bucket}`, () => {
          context.output_options.username = 'tyler';
          context.output_options.password = 'password';
          context.output_options.output = servers[i];
          context.output_options.bucket = bucket;
          const validateBucket = () => validate.bucket(bucket, context.output_options);
          expect(validateBucket).toThrow();
          expect(() => context.validateOutputOptions()).toThrow();
        });
      });
    });

    describe('username', () => {
      const passing = [ 'asdfasdfasdf', 'asdfasdfsadf', 'asfasdfasdfasdfasdf' ];
      const servers = [ 'sync-gateway', 'couchbase', 'sync-gateway', 'couchbase' ];
      passing.forEach((username, i) => {
        it(`passing ${username}`, () => {
          context.output_options.username = username;
          context.output_options.password = 'password';
          context.output_options.output = servers[i];
          expect(() => {
            validate.username(username, context.output_options);
            context.validateOutputOptions();
          }).not.toThrow();
        });
      });

      const failing = [ 2, '', [], {} ];
      failing.forEach((username, i) => {
        it(`failing ${username}`, () => {
          if (servers[i] !== 'couchbase') {
            context.output_options.username = username;
            context.output_options.password = 'password';
            context.output_options.output = 'sync-gateway';
            const validateUsername = () => validate.username(username, context.output_options);
            expect(validateUsername).toThrow();
            expect(() => context.validateOutputOptions()).toThrow();
          }
        });
      });
    });

    describe('password', () => {
      const passing = [ 'asdfasdfasdf', 'asdfasdfsadf', 'asfasdfasdfasdfasdf' ];
      const servers = [ 'sync-gateway', 'couchbase', 'sync-gateway', 'couchbase' ];
      passing.forEach((password, i) => {
        it(`passing ${password}`, () => {
          context.output_options.username = 'tyler';
          context.output_options.password = password;
          context.output_options.output = servers[i];
          expect(() => {
            validate.password(password, context.output_options);
            context.validateOutputOptions();
          }).not.toThrow();
        });
      });

      const failing = [ 2, [], {} ];
      failing.forEach((password, i) => {
        it(`failing ${password}`, () => {
          context.output_options.username = 'tyler';
          context.output_options.password = password;
          context.output_options.output = servers[i];
          const validatePassword = () => validate.password(password, context.output_options);
          expect(validatePassword).toThrow();
          expect(() => context.validateOutputOptions()).toThrow();
        });
      });

      describe('timeout', () => {
        const passing = [ 100, 200, 300, 400, 500, 600, 700, 800 ];
        passing.forEach((timeout) => {
          it(`passing ${timeout}`, () => {
            context.output_options.timeout = timeout;
            expect(() => {
              validate.timeout(timeout);
              context.validateOutputOptions();
            }).not.toThrow();
          });
        });
        const failing = [ '', [], {} ];
        failing.forEach((timeout) => {
          it(`failing ${timeout}`, () => {
            context.output_options.timeout = timeout;
            const validateTimeout = () => validate.timeout(timeout);
            expect(validateTimeout).toThrow();
            expect(() => context.validateOutputOptions()).toThrow();
          });
        });
      });
    });

    it('isServer', () => {
      expect(isServer('sync-gateway')).toBeTruthy();
      expect(isServer('couchbase')).toBeTruthy();
      expect(isServer('')).toBeFalsy();
      expect(isServer('asdfasd')).toBeFalsy();
      expect(isServer('asdfasdasdasafsdfsd')).toBeFalsy();
      expect(isServer(2)).toBeFalsy();
    });

    it('isString', () => {
      expect(isString('asdfasdf')).toBeTruthy();
      expect(isString('asdaffsdasdfasd')).toBeTruthy();
      expect(() => isString('')).toThrow();
      expect(() => isString(2)).toThrow();
      expect(() => isString([])).toThrow();
      expect(() => isString({})).toThrow();
    });
  });


  describe('prepare', () => {
    const root = p(output_root, 'prepare');

    it('without options', async () => {
      expect(context.prepared).toBe(false);
      expect(context.preparing).toBeUndefined();
      const preparing = context.prepare();
      expect(typeof context.preparing.then).toBe('function');
      expect(context.prepared).toBe(false);
      await preparing;
      expect(context.outputter).toBeUndefined();
      expect(context.prepared).toBe(true);
    });

    it('with output as console', async () => {
      context.output_options.output = 'console';
      expect(context.prepared).toBe(false);
      expect(context.preparing).toBeUndefined();
      const preparing = context.prepare();
      expect(typeof context.preparing.then).toBe('function');
      expect(context.prepared).toBe(false);
      await preparing;
      expect(context.outputter.constructor.name).toBe('Console');
      expect(context.prepared).toBe(true);
    });

    it('zip', async () => {
      context.options.root = root;
      context.output_options.output = 'zip';
      context.output_options.archive = 'archive.zip';
      expect(context.prepared).toBe(false);
      expect(context.preparing).toBeUndefined();
      const preparing = context.prepare();
      expect(typeof context.preparing.then).toBe('function');
      expect(context.prepared).toBe(false);
      await preparing;
      expect(context.outputter.constructor.name).toBe('Zip');
      expect(to.type(context.outputter.zip)).toBe('object');
      expect(context.prepared).toBe(true);
      expect(await globby('zip', { cwd: root })).toEqual([ 'zip' ]);
      expect(await globby(p('zip', '**', '*'), { cwd: root })).toEqual([]);
    });

    it('folder', async () => {
      context.options.root = root;
      context.output_options.output = 'folder';
      expect(context.prepared).toBe(false);
      expect(context.preparing).toBeUndefined();
      const preparing = context.prepare();
      expect(typeof context.preparing.then).toBe('function');
      expect(context.prepared).toBe(false);
      await preparing;
      expect(context.outputter.constructor.name).toBe('Folder');
      expect(context.prepared).toBe(true);
      expect(await globby('folder', { cwd: root })).toEqual([ 'folder' ]);
      expect(await globby(p('folder', '**', '*'), { cwd: root })).toEqual([]);
    });

    afterAll(() => fs.remove(root));
  });


  describe('setup', () => {
    it('without options', async () => {
      expect(context.prepared).toBe(false);
      expect(context.preparing).toBeUndefined();
      const preparing = context.setup();
      expect(typeof context.preparing.then).toBe('function');
      expect(context.prepared).toBe(false);
      await preparing;
      expect(context.outputter).toBeUndefined();
      expect(context.prepared).toBe(true);
    });

    it('with output as console', async () => {
      context.output_options.output = 'console';
      expect(context.prepared).toBe(false);
      expect(context.preparing).toBeUndefined();
      const preparing = context.setup();
      expect(typeof context.preparing.then).toBe('function');
      expect(context.prepared).toBe(false);
      await preparing;
      expect(context.outputter.constructor.name).toBe('Console');
      expect(context.prepared).toBe(true);
    });
  });


  describe('output', () => {
    const root = p(output_root, 'output');
    let data;

    beforeAll(async () => {
      data = await getData();
    });

    describe('return', () => {
      languages((language) => {
        it(language, async () => {
          const { raw, node } = data[language];
          context.output_options.output = 'return';
          context.output_options.format = language;
          expect(context.prepared).toBe(false);
          expect(context.preparing).toBeUndefined();
          const actual = await context.output(raw);
          expect(context.prepared).toBe(true);
          expect(actual).toEqual(node);
        });
      });
    });

    describe('console', () => {
      languages((language) => {
        it(language, async () => {
          const { raw, node } = data[language];
          context.output_options.output = 'console';
          context.output_options.format = language;
          expect(context.prepared).toBe(false);
          expect(context.preparing).toBeUndefined();
          startCapturing();
          await context.output(raw);
          const consoleOutput = stopCapturing();
          expect(context.prepared).toBe(true);
          expect(consoleOutput[0].trim()).not.toBe(node);
          if (language !== 'csv') {
            expect(stripColor(consoleOutput[0]).trim()).toBe(node);
          }
        });
      });
    });

    describe('folder', () => {
      languages((language) => {
        it(language, async () => {
          const { raw, nodes } = data[language];
          const keys = to.keys(nodes).sort();
          expect.assertions(keys.length + 4);
          // change the root folder to be under folder so it's easier
          // to remove the tests for `folder` after they're done.
          context.options.root = p(root, 'folder');
          const output = context.output_options.format = context.output_options.output = language;
          expect(context.prepared).toBe(false);
          expect(context.preparing).toBeUndefined();
          await context.output(raw);
          expect(context.prepared).toBe(true);

          // ge all the files in the output folder
          const files = await globby('*', { cwd: p(root, 'folder', output) });

          // all the files exist
          expect(files.map((file) => file.split('.')[0]).sort()).toEqual(keys);

          // this ensures that all the files match the correct output
          await map(files, async (file) => {
            const content = to.string(await fs.readFile(p(root, 'folder', output, file))).trim();
            const name = file.split('.')[0];
            expect(content).toEqual(nodes[name]);
          });
        });
      });
    });


    describe('zip', () => {
      languages((language) => {
        if (language !== 'json') {
          return;
        }
        it(language, async () => {
          const { raw, nodes } = data[language];
          const keys = to.keys(nodes).sort();

          // change the root folder to be under folder so it's easier
          // to remove the tests for `folder` after they're done.
          context.options.root = p(root, 'zip');
          context.output_options.format = context.output_options.output = language;
          context.output_options.archive = `${language}.zip`;
          expect(context.prepared).toBe(false);
          expect(context.preparing).toBeUndefined();
          await context.output(raw);
          expect(context.prepared).toBe(true);
          expect(to.type(context.outputter.zip)).toBe('object');
          const files = context.outputter.zip.getEntries().map(({ name }) => name.split('.')[0]);
          expect(files.sort()).toEqual(keys);
        });
      });
    });


    it('throws error', async () => {
      context.output_options.output = p(root, 'error-folder');
      await context.prepare();
      context.outputter.output = function output() {
        throw new Error('failed correctly');
      };
      startCapturing();

      await context.output(data.json.raw)
        .then(() => fail('should have thrown'))
        .catch(() => {});
      const consoleOutput = stopCapturing();
      expect(consoleOutput[1].split(/\n/)[0].trim()).toMatch(/\[?Error: failed correctly\]?/);
    });

    // These are too difficult to unit test but they are tested else where
    // describe('couchbase', () => {
    //   it.todo();
    // });
    //
    // describe('sync-gateway', () => {
    //   it.todo();
    // });

    afterAll(() => fs.remove(root));
  });
});

// This will loop through each of the languages to run tests for each one.
// It makes it easier to test each language for each type of output rather
// than duplicating the loop on each test
function languages(cb) {
  for (let language of [ 'cson', 'csv', 'json', 'yaml', 'yml' ]) {
    cb(language);
  }
}


// this generates the data that is used to test
// it returns an object of the language types and their data
// each language will have an object of
// {
//   raw: '', // the test data
//   node: '', // the expected file
//   nodes: {} // the expected nodes that will get created
// }
async function getData() {
  const file_types = [ 'cson', 'csv', 'json', 'yaml', 'yml' ];
  const root = p(__dirname, '..', 'fixtures', 'test-data');
  const raw = await fs.readJson(p(root, 'data.json'));

  return reduce(file_types, async (prev, next) => {
    const data = {
      // holds the full set of data
      // this is used for the console and return
      node: '',
      // holds the individual data nodes
      nodes: {},
      // the raw data nodes
      raw: to.clone(raw).map((node) => {
        Object.defineProperty(node, '__key', { value: `${next}-${node.id}` });
        Object.defineProperty(node, '__name', { value: `${next}-${node.id}` });
        return node;
      }),
    };

    const file = p(root, `data.${next}`);

    if (next === 'json') {
      data.node = to.json(raw);
    } else {
      data.node = to.string(await fs.readFile(file)).trim().replace(/\r\n/g, '\n');
    }

    switch (next) {
      case 'yaml':
      case 'yml':
        data.nodes = data.node
          .replace(/^\s+/gm, '')
          .split('-')
          .filter(Boolean)
          .map((line) => line.trim());
        break;
      case 'cson':
        data.nodes = data.node
          .split('\n')
          .slice(1, -1)
          .join('\n')
          .split(/(?={)/)
          .map((item) => item.replace(/[{}]| \s{2,}/g, '').trim())
          .filter(Boolean);
        break;
      case 'json':
        data.nodes = to.object(data.node).map((item) => to.json(item));
        break;
      case 'csv':
        data.nodes = {
          [`csv-${raw[0].id}`]: data.node
        };
        break;
      default:
        data.nodes = data.node;
    }

    if (next !== 'csv') {
      let items = data.nodes;
      data.nodes = {};
      for (let [ i, node ] of to.entries(raw)) {
        data.nodes[`${next}-${node.id}`] = items[i];
      }
    }

    prev[next] = data;
    return prev;
  }, {});
}

import { describe, expect, test, beforeAll, beforeEach, afterAll } from '@jest/globals';
import default_options from '../app/output/default-options';
import to from 'to-js';
import globby from 'globby';
import fs from 'fs-extra-promisify';
import path, { join as p } from 'path';
import { stripColor } from 'chalk';
import AdmZip from 'adm-zip';
import Fakeit from '../app/index.js';
import { startCapturing, stopCapturing } from './console';
import { models as getModels } from './utils';

const fakeit_root = p(__dirname, 'fixtures', 'models');
const folder_root = p(__dirname, 'fixtures', 'fakeit-folder-test');
const zip_root = p(__dirname, 'fixtures', 'fakeit-zip-test');

const models = getModels({
  root: fakeit_root,
  // Get the models to test. This is used by the `models` function located at the bottom of this file
  modules: '*/models/*.yaml',
  // this gets the correct validation file to use on a per test basis
  validation(model) {
    return model.replace(/models(.*)\.yaml/g, 'validation$1.data.js');
  }
});

describe('fakeit', () => {
  let fakeit;
  let defaults;

  beforeAll(() => Promise.all([ fs.remove(folder_root), fs.remove(zip_root) ]));

  beforeEach(() => {
    fakeit = new Fakeit({
      root: fakeit_root,
      count: 1,
      log: false
    });

    defaults = to.clone(default_options);
  });


  test('without args', async () => {
    delete fakeit.options.count;
    fakeit.options.log = fakeit.options.spinners = true;

    expect(fakeit.options).toEqual({
      root: fakeit_root,
      log: true,
      verbose: false,
      spinners: true,
      timestamp: true,
    });
    expect(to.type(fakeit.documents)).toBe('object');
    expect(to.type(fakeit.globals)).toBe('object');
  });


  describe('generate', () => {
    test('generate no models', async () => {
      // you can run generate an nothing will happen
      try {
        await fakeit.generate();
      } catch {
        throw new Error('Failed to generate with no models');
      }
    });

    describe('console', () => {
      test.each(models.files)('console output for %p', async (model) => {
        defaults.output = 'console';

        startCapturing();
        await fakeit.generate(model, defaults);
        const consoleOutput = stopCapturing();
        const actual = to.object(stripColor(consoleOutput[0].trim()))[0];

        expect(actual).toBeDefined();
      });
    });

    describe('return', () => {
      test.each(models.files)('return output for %p', async (model) => {
        defaults.output = 'return';
        let actual = await fakeit.generate(model, defaults);
        // get the first item in the list of the tests
        // and convert it to an object
        actual = to.object(actual[0]);
        // get the first item in the array to test
        expect(actual[0]).toBeDefined();
      });
    });

    describe('supports globs', () => {
      test('ecommerce/**/*.yaml', async () => {
        defaults.output = 'return';
        const actual = await fakeit.generate('ecommerce/**/*.yaml', defaults);

        expect(actual.length).toBe(4);
        const doc_types = actual.map((item) => to.object(item)[0].doc_type).sort();
        expect(doc_types).toEqual([ 'product', 'user', 'review', 'order' ].sort());
      });

      test('ecommerce/**/@(o|p)*.yaml', async () => {
        defaults.output = 'return';
        const actual = await fakeit.generate('ecommerce/**/@(orders|products).yaml', defaults);

        // only the files that were passed should be returned which should be `products`, and `orders`
        const doc_types = actual.map((item) => to.object(item)[0].doc_type).sort();
        expect(doc_types).toEqual([ 'order', 'product' ]);
      });
    });

    describe('folder', () => {
      test.each(models.files)('folder output for %p', async (model) => {
        const root = p(folder_root, model.replace(/[/\\]/g, '-').replace('.yaml', ''));
        defaults.output = root;
        await fakeit.generate(model, defaults);
        const files = await globby(p(root, '**', '*'));
        expect(files.length).toBe(1);
        const json = await fs.readJson(files[0]);
        expect(json).toBeDefined();
      });
    });

    describe('zip', () => {
      test.each(models.files)('zip output for %p', async (model) => {
        const root = p(zip_root, model.replace(/[/\\]/g, '-').replace('.yaml', ''));
        defaults.output = root;
        defaults.archive = 'archive.zip';
        await fakeit.generate(model, defaults);
        const files = await globby(p(root, '**', '*'));
        expect(files.length).toBe(1);
        expect(path.extname(files[0])).toBe('.zip');
        const zip = new AdmZip(files[0]);
        expect(zip.getEntries().length).toBe(1);
        const entry_file = zip.getEntries()[0].name;
        expect(path.extname(entry_file)).toBe('.json');
        // read the entry_file from the zip file and convert it to an object from a json string
        const obj = to.object(await zip.readAsText(entry_file));
        expect(obj).toBeDefined();
      });
    });
  });


  // couchbase and sync-gateway are too difficult to test in this way
  // since we have to use the mock equivalents of some of their inner functions
  // so they are not tested here, but they're functionality is tested else where.
  // describe('couchbase', () => {
  //   test('couchbase tests', async () => {
  //     expect(typeof model).toBe('string');
  //   });
  // });
  //
  // describe('sync-gateway', () => {
  //   test('sync-gateway tests', async () => {
  //     expect(typeof model).toBe('string');
  //   });
  // });

  afterAll(() => {
    models.todo();
    return Promise.all([ fs.remove(folder_root), fs.remove(zip_root) ]);
  });
});

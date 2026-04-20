 

import Models, {
  parseModelInputs,
  parseModelFunctions,
  parseModelReferences,
  parseModelTypes,
  parseModelDefaults,
  parseModelCount,
  parseModelSeed,
  resolveDependenciesOrder,
} from '../app/models.js';
import path, { join as p } from 'path';
import { describe, expect, test, beforeAll, beforeEach, afterAll } from '@jest/globals';
import to from '../app/to.js';
import is from 'joi';
import _ from 'lodash';
import fs from 'fs-extra-promisify';
import AdmZip from 'adm-zip';
const models_root = p(__dirname, 'fixtures', 'models');
import { stripColor } from 'chalk';
import { startCapturing, stopCapturing } from './console';
/* istanbul ignore next */
const utils = require('./utils');
const models = utils.models({
  root: models_root,
  // Get the models to test. This is used by the `models` function located at the bottom of this file
  modules: '*/models/*.yaml',
  // this gets the correct validation file to use on a per test basis
  validation(model) {
    return model.replace(/models(.*)\.yaml/g, 'validation$1.model.js');
  }
});

let babel_config, contents, modelsInstance;

describe('models', () => {
  beforeAll(async () => {
    babel_config = await fs.readJson(p(__dirname, '..', 'babel.config.json'));
    // get the contents of the models store them on an object so it can be reused
    contents = await models.getContents();
  });

  beforeEach(() => {
    modelsInstance = new Models({
      root: models_root,
      log: false,
      babel_config: 'babel.config.json',
    });
  });

  test('without args', () => {
    modelsInstance.options.log = true;
    const expected = {
      // inherited from events-async
      domain: null,
      _events: {},
      _eventsCount: 0,
      _maxListeners: 50,

      options: {
        root: models_root,
        log: true,
        verbose: false,
        spinners: false,
        timestamp: true,
        count: 0,
        seed: 0,
        babel_config: 'babel.config.json'
      },
      log_types: is.object().required(),
      inputs: is.object().length(0),
      models: is.array().length(0),
      prepared: is.boolean(),
      registered_models: is.array().length(0),
      spinners: is.object().required(),
    };
    const { error } = is.object(expected).validate(modelsInstance);
    if (error) {
      throw error;
    }
  });

  test('prepare', async () => {
    expect(modelsInstance.prepared).toBe(false);
    expect(modelsInstance.preparing).toBe(undefined);
    expect(typeof modelsInstance.options.babel_config).toBe('string');
    const preparing = modelsInstance.prepare();
    expect(typeof modelsInstance.preparing.then).toBe('function');
    expect(modelsInstance.prepared).toBe(false);
    await preparing;
    expect(modelsInstance.prepared).toBe(true);
    expect(typeof modelsInstance.options.babel_config).toBe('object');
    expect(modelsInstance.options.babel_config).toEqual(babel_config);
  });

  describe('setup', () => {
    test('babel_config as a string', async () => {
      expect(modelsInstance.prepared).toBe(false);
      expect(modelsInstance.preparing).toBe(undefined);
      expect(typeof modelsInstance.options.babel_config).toBe('string');
      const preparing = modelsInstance.setup();
      expect(typeof modelsInstance.preparing.then).toBe('function');
      expect(modelsInstance.prepared).toBe(false);
      await preparing;
      expect(modelsInstance.prepared).toBe(true);
      expect(typeof modelsInstance.options.babel_config).toBe('object');
      expect(modelsInstance.options.babel_config).toEqual(babel_config);
    });

    test('babel_config as an object', async () => {
      expect(modelsInstance.prepared).toBe(false);
      expect(modelsInstance.preparing).toBe(undefined);
      modelsInstance.options.babel_config = babel_config;
      expect(to.type(modelsInstance.options.babel_config)).toBe('object');
      const preparing = modelsInstance.setup();
      expect(typeof modelsInstance.preparing.then).toBe('function');
      expect(modelsInstance.prepared).toBe(false);
      await preparing;
      expect(modelsInstance.prepared).toBe(true);
      expect(to.type(modelsInstance.options.babel_config)).toBe('object');
      expect(modelsInstance.options.babel_config).toEqual(babel_config);
    });

    test.skip('babel_config in the package.json', async () => {
      expect(modelsInstance.prepared).toBe(false);
      expect(modelsInstance.preparing).toBe(undefined);
      modelsInstance.options.babel_config = 'package.json';
      expect(typeof modelsInstance.options.babel_config).toBe('string');
      const preparing = modelsInstance.setup();
      expect(typeof modelsInstance.preparing.then).toBe('function');
      expect(modelsInstance.prepared).toBe(false);
      await preparing;
      expect(modelsInstance.prepared).toBe(true);
      expect(to.type(modelsInstance.options.babel_config)).toBe('object');
      expect(modelsInstance.options.babel_config).toEqual(babel_config);
    });

    test.skip('babel_config process.cwd failed to find a babel config', async () => {
      expect(modelsInstance.prepared).toBe(false);
      expect(modelsInstance.preparing).toBe(undefined);
      modelsInstance.options.root = modelsInstance.options.root.split('fakeit')[0].slice(0, -1);
      modelsInstance.options.babel_config = 'package.json';
      expect(typeof modelsInstance.options.babel_config).toBe('string');
      const preparing = modelsInstance.setup();
      expect(typeof modelsInstance.preparing.then).toBe('function');
      expect(modelsInstance.prepared).toBe(false);
      await preparing;
      expect(modelsInstance.prepared).toBe(true);
      expect(to.type(modelsInstance.options.babel_config)).toBe('object');
      expect(modelsInstance.options.babel_config).toEqual(babel_config);
    });
  });

  describe('registerModels', () => {
    test('without args', async () => {
      // you can run registerModels and nothing will happen
      await modelsInstance.registerModels();
    });

    // throws error if this isn't defined
    test.todo('without model.type value');

    // throws error if this isn't defined
    test.todo('without model.key value');

    describe('should register models', () => {
      models(async (file) => {
        const original_model = to.clone(contents[file]);
        // min length of the models expected
        const min = (original_model.data.dependencies || []).length;
        // registerModel
        await modelsInstance.registerModels(file);

        // ensure that the registered_models and models length is greater
        // than the min length. We can't check for exact length here because
        // a dependency might depend on other dependencies
        expect(modelsInstance.registered_models.length >= min).toBeTruthy();
        expect(modelsInstance.models.length >= min).toBeTruthy();
        const resolvedFile = modelsInstance.resolvePaths(file)[0];
        const actual = _.find(modelsInstance.models, [ 'file', resolvedFile ]);
        const dependencies = _.without(modelsInstance.models, actual);
        expect(actual.is_dependency).toBe(false);
        expect(actual.root).toBe(path.resolve(modelsInstance.options.root, path.dirname(actual.file)));
        // ensure the dependencies are set as dependencies
        for (let dependency of dependencies) {
          expect(dependency.is_dependency).toBe(true);
        }
        return actual;
      })();
    });

    test('fails when filepath that was passed doesn\'t exist', async () => {
      startCapturing();
      await modelsInstance.registerModels('lol/i/do/not/exist.yaml')
        .then(() => {
          throw new Error('Expected registerModels to fail');
        })
        .catch(() => {
          // Expected to fail
        });
      const consoleOutput = stopCapturing();
      expect(stripColor(consoleOutput[0]).trim()).toMatch(/^\[[0-9]{1,2}:[0-9]{1,2}:[0-9]{1,2}\]\s+.\s+error:$/);
      expect(consoleOutput[1]).toMatch(/ENOENT: no such file or directory/);
    });
  });

  test('parseModel', () => {
    expect(typeof modelsInstance.parseModel).toBe('function');
  });

  describe('filterModelFiles', () => {
    test('filter none', () => {
      expect(modelsInstance.registered_models).toEqual([]);
      expect(modelsInstance.filterModelFiles([ 'foo.yaml', 'bar.yaml' ])).toEqual([ 'foo.yaml', 'bar.yaml' ]);
    });
    test('filter files that aren\'t yaml', () => {
      expect(modelsInstance.filterModelFiles([ 'foo.yaml', 'bar.yaml', 'baz.zip', 'qux.json', 'quxx.cson' ])).toEqual([ 'foo.yaml', 'bar.yaml' ]);
    });
    test('filter files that have been registered already', () => {
      modelsInstance.registered_models.push('foo.yaml');
      expect(modelsInstance.filterModelFiles([ 'foo.yaml', 'bar.yaml', 'baz.zip', 'qux.json', 'quxx.cson' ])).toEqual([ 'bar.yaml' ]);
    });
  });

  describe('parseModelDependencies', () => {
    models(async (file) => {
      const model = to.clone(contents[file]);

      model.data.dependencies = modelsInstance.resolvePaths(model.data.dependencies, path.resolve(modelsInstance.options.root, path.dirname(file)));

      await modelsInstance.parseModelDependencies(model);
      if (model.data.dependencies.length === 0) {
        // No dependencies to check
      } else {
        const length = modelsInstance.models.length;
        expect(length).toBe(to.unique(modelsInstance.registered_models).length);
      }

      let count = 0;

      function check(dependencies) {
        if (count++ >= 20) {
          throw new Error('parseModelDependencies has ran too many checks');
        }

        for (let dependency_path of dependencies) {
          expect(modelsInstance.registered_models.includes(dependency_path)).toBeTruthy();
          const dependency = _.find(modelsInstance.models, [ 'file', dependency_path ]);
          if (dependency_path === file) {
            expect(dependency.is_dependency).toBeFalsy();
          } else {
            expect(dependency.is_dependency).toBeTruthy();
          }
          if (dependency.data.dependencies.length) {
            check(dependency.data.dependencies);
          }
        }
      }

      check(model.data.dependencies);
    })();
  });

  describe('parseModelInputs', () => {
    models(async (file) => {
      expect(to.keys(modelsInstance.inputs).length).toBe(0);
      const model = to.clone(contents[file]);

      let files = model.data.inputs = modelsInstance.resolvePaths(model.data.inputs, path.resolve(modelsInstance.options.root, path.dirname(file)));
      files = files.map((str) => {
        if (!/.*\.zip/.test(str)) return str;
        const zip = new AdmZip(str);
        return zip.getEntries().map((entry) => {
          if (!entry.isDirectory && !entry.entryName.match(/^(\.|__MACOSX)/)) {
            return entry.entryName;
          }
        });
      });
      files = to.flatten(files).filter(Boolean);

      const expected = files.reduce((prev, next) => {
        prev[path.basename(next).split('.')[0]] = is.any().allow(is.array(), is.object());
        return prev;
      }, {});

      const actual = await parseModelInputs(model);

      expect(to.type(model.data.inputs)).toBe('array');

      const tests = [ modelsInstance.inputs, actual ];

      for (let item of tests) {
        const { error } = is.object(expected).validate(item);
        if (error) {
          throw error;
        }
      }
    })();
  });

  describe('parseModelFunctions', () => {
    describe('ensure all `pre` and `post` instances are functions', () => {
      models((file) => {
        const model = to.clone(contents[file]);
        const paths = utils.getPaths(model, /((pre|post)_run)|(pre_|post_)?build$/);
        const obj = _.pick(model, paths);
        parseModelFunctions(obj, babel_config);

        for (let str of paths) {
          let fn = _.get(obj, str);
          expect(typeof fn).toBe('function');
          expect(fn.name).toBe(to.camelCase(str));
        }
        return obj;
      })();
    });

    describe('ensure es6 support', () => {
      const tests = [
        {
          name: 'single line has a return',
          actual: '`contact_${this.contact_id}`',
          expected: "function build(_documents, _globals, _inputs, _faker, _chance, _document_index, _require) {\n  function __result(documents, globals, inputs, faker, chance, document_index, require) {\n    return `contact_${this.contact_id}`;\n  }\n  return __result.apply(this, [].slice.call(arguments));\n}",
        },
        {
          name: 'multi line doesn\'t have automatic return',
          actual: 'console.log("woohoo");\n`contact_${this.contact_id}`',
          expected: "function build(_documents, _globals, _inputs, _faker, _chance, _document_index, _require) {\n  function __result(documents, globals, inputs, faker, chance, document_index, require) {\n    console.log(\"woohoo\");\n    `contact_${this.contact_id}`;\n  }\n  return __result.apply(this, [].slice.call(arguments));\n}",
        },
        {
          name: 'object deconstruction',
          actual: 'const { countries } = inputs\nreturn `${this.contact_id}${countries[0]}`',
          expected: "function build(_documents, _globals, _inputs, _faker, _chance, _document_index, _require) {\n  function __result(documents, globals, inputs, faker, chance, document_index, require) {\n    const {\n      countries\n    } = inputs;\n    return `${this.contact_id}${countries[0]}`;\n  }\n  return __result.apply(this, [].slice.call(arguments));\n}",
        },
      ];

      test.each(tests)('$name', ({ name, actual: build, expected }) => {
        let actual = { name, build };
        parseModelFunctions(actual, babel_config);
        actual = actual.build;
        expect(typeof actual).toBe('function');
        expect(actual.toString()).toBe(expected);
      });
    });

    test('babel failed to compile', () => {
      let actual = {
        file: __dirname,
        build: 'cons { countries } = woohoo\nreturn `${this.contact_id}${countries[0]}`',
      };
      const tester = () => parseModelFunctions(actual, babel_config);
      expect(tester).toThrow(`Failed to transpile build with babel in ${__dirname}\nunknown: Missing semicolon. (2:6)`);
    });

    test('failed to create function', () => {
      let actual = {
        file: __dirname,
        build: 'var shoot = "woohoo"',
      };
      const tester = () => parseModelFunctions(actual);
      expect(tester).toThrow('Function Error in model \'undefined\', for property: build, Reason: Unexpected token \'var\'');
    });

    describe('functions are returning values correctly', () => {
      const tests = [
        'documents',
        'globals',
        'inputs',
        'faker',
        'chance',
        'document_index',
        'this',
      ];

      tests.forEach((name, i) => {
        test(`${name} is returned correctly`, () => {
          const stub = tests.map(() => null);
          stub[i] = name;
          const expected = `function build(_documents, _globals, _inputs, _faker, _chance, _document_index, _require) {\n  function __result(documents, globals, inputs, faker, chance, document_index, require) {\n    return \`\${${name}}[${i}]\`;\n  }\n  return __result.apply(this, [].slice.call(arguments));\n}`;
          let actual = {
            name,
            build: `\`$\{${name}}[${i}]\``
          };
          parseModelFunctions(actual, babel_config);
          actual = actual.build;
          expect(typeof actual).toBe('function');
          expect(actual.toString()).toBe(expected);
          expect(actual.apply(name, stub)).toBe(`${name}[${i}]`);
        });
      });
    });
  });

  describe('parseModelReferences', () => {
    models((file) => {
      const model = to.clone(contents[file]);
      const original_model = to.clone(contents[file]);
      const pattern = /\.(schema|items).\$ref$/;
      const paths = utils.getPaths(model, pattern);
      parseModelReferences(model);
      
      for (let ref of paths) {
        let set_location = ref.replace(pattern, '');
        if (ref.includes('.items.')) {
          set_location += '.items';
        }
        const get_location = _.get(original_model, ref).replace(/^#\//, '').replace('/', '.');
        const expected = to.extend(to.clone(_.get(original_model, set_location)), _.get(original_model, get_location));
        const actual = _.get(model, set_location);

        const { error } = is.compile(expected).validate(actual);

        if (error) {
          throw error;
        }
      }
    })();
  });

  describe('parseModelTypes', () => {
    models((file) => {
      const model = to.clone(contents[file]);
      const pattern = /.*properties\.[^.]+(\.items)?$/;
      const paths = utils.getPaths(model, pattern);
      const to_check = [];
      for (let str of paths) {
        if (_.get(model, str).type == null) {
          to_check.push(str);
        }
      }

      parseModelTypes(model);

      for (let str of to_check) {
        expect(_.get(model, str).type).toBe('null');
      }
    })();
  });

  describe('parseModelDefaults', () => {
    models((file) => {
      const test_model = to.clone(contents[file]);
      const model = to.clone(contents[file]);
      const pattern = /^(.*properties\.[^.]+)$/;
      const paths = utils.getPaths(model, pattern);
      parseModelDefaults(model);

      test_model.data = to.extend({ min: 0, max: 0, count: 0 }, test_model.data || {});

      expect(model.data).toEqual(test_model.data);
      expect(model.data.min).toBe(test_model.data.min);
      expect(model.data.max).toBe(test_model.data.max);
      expect(model.data.count).toBe(test_model.data.count);

      for (let data_path of paths) {
        let property = _.get(model, data_path);
        expect(typeof property).toBe('object');
        if (property.type === 'array' && property.items) {
          expect(typeof property.items.data).toBe('object');
          expect(typeof property.items.data.min).toBe('number');
          expect(typeof property.items.data.max).toBe('number');
          expect(typeof property.items.data.count).toBe('number');
        } else {
          expect(typeof property.data).toBe('object');
        }
      }
    })();
  });

  describe('parseModelCount', () => {
    function getContext() {
      const obj = { data: { count: 0 } };

      obj.data.min = to.random(0, 100);
      obj.data.max = to.random(obj.data.min, 300);
      return obj;
    }

    describe('uses passed count', () => {
      {
        const number = to.random(1, 100);
        test(`(${number}) over data.min and data.max settings`, () => {
          const obj = getContext();
          expect(obj.data.count).toBeFalsy();
          parseModelCount(obj, number);
          expect(obj.data.count).toBeTruthy();
          expect(obj.data.count).toBe(number);
        });
      }
      {
        const number = to.random(1, 100);
        test(`(${number}) over over data.count setting`, () => {
          const obj = getContext();
          expect(obj.data.count).toBeFalsy();
          obj.data.count = 200;
          parseModelCount(obj, number);
          expect(obj.data.count).toBeTruthy();
          expect(obj.data.count).not.toBe(200);
          expect(obj.data.count).toBe(number);
        });
      }
    });

    test('returns a typeof number when a string is passed in', () => {
      const obj = getContext();
      expect(obj.data.count).toBeFalsy();
      parseModelCount(obj, '1');
      expect(obj.data.count).toBeTruthy();
      expect(obj.data.count).toBe(1);
    });

    test('returns a 1 when "0" is passed in as the count override', () => {
      const obj = getContext();
      expect(obj.data.count).toBeFalsy();
      parseModelCount(obj, '0');
      const actual = obj.data.count;
      expect(actual).toBeTruthy();
      expect(actual >= obj.data.min && actual <= obj.data.max).toBeTruthy();
    });

    test('chooses random number', () => {
      const obj = getContext();
      expect(obj.data.count).toBeFalsy();
      parseModelCount(obj);
      const actual = obj.data.count;
      expect(actual).toBeTruthy();
      expect(actual >= obj.data.min && actual <= obj.data.max).toBeTruthy();
    });

    test('uses data.count', () => {
      const obj = getContext();
      expect(obj.data.count).toBeFalsy();
      const expected = obj.data.count = to.random(1, 100);
      parseModelCount(obj);
      expect(obj.data.count).toBeTruthy();
      expect(obj.data.count).toBe(expected);
    });

    test('returns 1 when nothing is set', () => {
      const obj = { data: {} };
      parseModelCount(obj);
      expect(obj.data.count).toBeTruthy();
      expect(obj.data.count).toBe(1);
    });

    test('returns 1 when data is 0', () => {
      const obj = {
        data: { min: 0, max: 0, count: 0 },
      };
      parseModelCount(obj);
      expect(obj.data.count).toBeTruthy();
      expect(obj.data.count).toBe(1);
    });

    describe('with different files', () => {
      models((file) => {
        const model = to.clone(contents[file]);
        parseModelDefaults(model);
        parseModelCount(model);
        expect(model.data.count > 0).toBeTruthy();
        if (model.data.max) {
          expect(model.data.count <= model.data.max).toBeTruthy();
          expect(model.data.count >= model.data.min).toBeTruthy();
        }
      })();
    });
  });

  describe('parseModelSeed', () => {
    function toNumber(str) {
      let result = '';
      for (let char of str) {
        result += char.charCodeAt(0);
      }
      return parseInt(result);
    }

    test('uses passed seed abc', () => {
      const model = {};
      const seed = 'abc';
      parseModelSeed(model, seed);
      expect(typeof model.seed).toBe('number');
      expect(model.seed).toBe(toNumber(seed));
    });

    test('uses passed seed def when model has a seed set', () => {
      const original_seed = 'abc';
      const model = { seed: original_seed };
      const seed = 'def';
      parseModelSeed(model, seed);
      expect(typeof model.seed).toBe('number');
      expect(model.seed).not.toBe(toNumber(original_seed));
      expect(model.seed).toBe(toNumber(seed));
    });

    test('set seed ghi', () => {
      const seed = 'ghi';
      const model = { seed };
      parseModelSeed(model);
      expect(typeof model.seed).toBe('number');
      expect(model.seed).toBe(toNumber(seed));
    });

    test('seed us set to null when it\'s not defined or passed', () => {
      const model = {};
      parseModelSeed(model);
      expect(model.seed == null).toBeTruthy();
    });

    test('seed uses set number 123456789', () => {
      const model = { seed: 123456789 };
      parseModelSeed(model);
      expect(model.seed).toBe(123456789);
    });
  });

  describe('resolveDependenciesOrder', () => {
    const tests = [];

    function create(title, actual = [], expected) {
      function createItem(item) {
        if (typeof item === 'number') {
          return actual[item];
        }
        item = to.array(item);
        return {
          file: item[0],
          data: { dependencies: item.slice(1) },
        };
      }
      actual = to.array(actual).map(createItem);
      expected = !expected ? actual : expected.map(createItem);
      tests.push({ title, actual, expected });
    }

    create('no models were passed');

    create('single model passed', 'one');

    create(
      'one level of dependencies already in order',
      [
        'one',
        [ 'two', 'one' ],
      ]
    );

    create('one level of dependencies in reverse order',
      // actual
      [
        [ 'one', 'two' ],
        [ 'two' ],
      ],
      // expected
      [ 1, 0 ],
    );

    create('one level of multiple dependencies',
      // actual
      [
        [ 'one', 'two', 'three' ],
        'two',
        'three',
      ],
      // expected
      [ 1, 2, 0 ],
    );

    create('multiple levels of dependencies',
      // actual
      [
        [ 'one', 'two' ],
        [ 'two', 'three' ],
        'three',
      ],
      // expected
      [ 2, 1, 0 ],
    );

    create('multiple levels of multiple dependencies',
      // actual
      [
        [ 'one', 'two', 'four' ],
        [ 'two', 'three' ],
        'three',
        'four',
      ],
      // expected
      [ 2, 1, 3, 0 ],
    );

    create('multiple levels of multiple dependencies reversed',
      // actual
      [
        'four',
        'three',
        [ 'two', 'three' ],
        [ 'one', 'two', 'four' ],
      ],
      // expected
      [ 0, 1, 2, 3 ],
    );

    create('multiple levels of multiple dependencies with same dependencies',
      // actual
      [
        [ 'one', 'two', 'four' ],
        [ 'two', 'three' ],
        [ 'three', 'four' ],
        [ 'four', 'five' ],
        'five',
        'six',
        'seven',
      ],
      // expected
      [ 4, 3, 2, 1, 0, 5, 6 ],
    );

    create('multiple levels of multiple dependencies with same dependencies variation',
      // actual
      [
        [ 'two', 'three' ],
        [ 'three', 'four' ],
        [ 'four', 'five' ],
        'five',
        'six',
        'seven',
        [ 'one', 'two', 'four' ],
      ],
      // expected
      [ 3, 2, 1, 0, 4, 5, 6 ],
    );

    test.each(tests)('$title $#', ({ title, actual, expected }) => {
      actual = resolveDependenciesOrder(actual);
      const diff = utils.checkDiff(actual, expected);
      if (diff) {
        throw new Error(title + '\n' + diff);
      }
    });
  });

  // log all the schema keys that still need to be done
  afterAll(models.todo);
});

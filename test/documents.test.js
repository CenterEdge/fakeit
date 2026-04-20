import { describe, expect, test, beforeAll, beforeEach } from '@jest/globals';
import {
  transformValueToType,
  getPaths,
  typeToValue,
  Document,
} from '../app/documents.js';
/* istanbul ignore next : needed to test models */
const Model = require('../app/models.js').default;
import { join as p } from 'path';
import to from '../app/to.js';
import is from 'joi';
import _ from 'lodash';
import fs from 'fs-extra-promisify';
const documents_root = p(__dirname, 'fixtures', 'models');
/* istanbul ignore next */
const utils = require('./utils');
const models = utils.models({
  root: documents_root,
  // Get the models to test. This is used by the `models` function located at the bottom of this file
  modules: '*/models/*.yaml',
  // this gets the correct validation file to use on a per test basis
  validation(model) {
    return model.replace(/models(.*)\.yaml/g, 'validation$1.data.js');
  }
});

let babel_config;

describe('documents', () => {
  let model, documents, globals, inputs, document;

  beforeAll(async () => {
    babel_config = await fs.readJson(p(__dirname, '..', 'babel.config.json'));
  });

  beforeEach(async () => {
    model = new Model({
      root: documents_root,
      log: false,
      babel_config,
    });
    documents = {};
    globals = {};
    inputs = {};
    document = new Document({
      root: documents_root,
      log: false,
    }, documents, globals, inputs);

    await model.setup();
  });


  test('without args', () => {
    const doc = document;
    // rest the log option to what it is by default.
    doc.options.log = doc.options.spinners = true;
    expect(doc.options).toEqual({
      root: documents_root,
      log: true,
      verbose: false,
      spinners: true,
      count: 0,
      timestamp: true,
    });
    expect(to.type(doc.log_types)).toBe('object');
    expect(doc.documents).toEqual({});
    expect(doc.globals).toEqual({});
    expect(doc.inputs).toEqual({});
    expect(to.type(doc.faker)).toBe('object');
    expect(to.type(doc.chance)).toBe('object');
  });


describe('build', () => {
  test('model with no data', async () => {
    const model = {
      name: 'build_test',
      type: 'object',
      properties: {
        test: {
          type: 'string',
          data: {
            build(documents, globals) {
              globals.woohoo = 'woohoo';
              return 'woohoo';
            },
          }
        }
      }
    };

    expect(document.globals).toEqual({});
    expect(document.documents).toEqual({});
    const actual = await document.build(model);
    const schema = is.array()
      .items(is.object({
        test: is.string().pattern(/woohoo/),
      }))
      .length(1);
    is.assert(actual, schema);
    is.assert(document.documents, is.object({ build_test: schema }));
    expect(document.globals).toEqual({ woohoo: 'woohoo' });
  });

  describe('key', () => {
    const model = {
      name: 'key_test',
      type: 'object',
      properties: {
        _id: {
          type: 'string',
          data: {
            value: '00000',
          }
        },
        test: {
          type: 'string',
          data: {
            value: 'woohoo',
          }
        }
      }
    };

    const tests = [
      {
        expected: 'key_test_0',
      },
      {
        actual: { data: { value: 'value' } },
        expected: 'value',
      },
      {
        actual: { data: { build: () => 'build' } },
        expected: 'build',
      },
      {
        actual: { data: { fake: '{{finance.account}}' } },
        expected: /^[0-9]{8}$/,
      },
      {
        actual: '_id',
        expected: '00000',
      },
    ];

    test.each(tests)('is $title', async ({ actual, expected }) => {
      const obj = to.clone(model);
      if (actual != null) {
        obj.key = actual;
      }
      const result = await document.build(obj);
      if (to.type(expected) === 'regexp') {
        expect(result[0].__key).toMatch(expected);
      } else {
        expect(result[0].__key).toBe(expected);
      }
    });
  });

  // describe(models(async (file) => {
  //   // ensure that only 1 document gets created
  //   document.options.count = model.options.count = 1;
  //   await model.registerModels(file);

  //   // set the document inputs to be what the model inputs are
  //   document.inputs = model.inputs;

  //   let actual = [];

  //   for (let obj of model.models) {
  //     expect(obj.data.count).toBe(1);

  //     let result = await document.build(obj);
  //     // ensure data count is still set to 1
  //     expect(obj.data.count).toBe(1);
  //     expect(result.length).toBe(1);
  //     if (!obj.is_dependency) {
  //       actual.push(result[0]);
  //     }
  //   }
  //   // ensure there was only 1 item output
  //   expect(actual.length).toBe(1);
  //   return actual[0];
  // }).toString().match(/models\((.*?)\)/s)[1], () => {
  //   // dynamic test group
  // });

  describe('seed', () => {
    const min = 2;
    const max = 10;
    const expected_phone_lengths = [ 2, 1, 3, 3, 3, 3, 3, 1, 1, 1 ];
    // used to generate a new model
    function getModel(is_expected) {
      if (typeof is_expected !== 'boolean') {
        is_expected = false;
      }
      return {
        name: 'test',
        type: 'object',
        seed: 123456789,
        data: { min, max, count: is_expected ? max : to.random(2, 10), inputs: {}, dependencies: [], },
        properties: {
          phones: {
            type: 'array',
            description: 'An array of phone numbers',
            items: {
              type: 'object',
              data: { min: 1, max: 3, count: 0, },
              properties: {
                type: {
                  type: 'string',
                  data: {
                    build(documents, globals, inputs, faker, chance) { // eslint-disable-line
                      return faker.random.arrayElement([ 'Home', 'Work', 'Mobile', 'Main', 'Other' ]);
                    },
                  },
                },
                phone_number: {
                  type: 'string',
                  data: {
                    build(documents, globals, inputs, faker, chance) { // eslint-disable-line
                      return faker.phone.phoneNumber().replace(/\s*x[0-9]+$/, '');
                    },
                  },
                },
                extension: {
                  type: 'string',
                  data: {
                    build(documents, globals, inputs, faker, chance) {  
                      return chance.bool({ likelihood: 20 }) ? chance.integer({ min: 1000, max: 9999 }).toString() : null;
                    },
                  },
                },
              },
            },
          },
        },
      };
    }

    test('phones array lengths are the same', async () => {
      const count = document.faker.random.number({ min: 10, max: 200 });
      for (var i = 0; i < count; i++) {
        const testModel = getModel();
        // reset the documents for each iteration
        document.documents = {};
        const actual = await document.build(testModel);
        expect(actual.length).toBe(testModel.data.count);
        const lengths = actual.map((obj) => obj.phones.length);
        expect(lengths).toEqual(expected_phone_lengths.slice(0, lengths.length));
      }
    });


    test('none of the items in phones array are the same', async () => {
      const testModel = getModel();
      const actual = await document.build(testModel);
      const phones = actual.map((obj) => obj.phones);
      phones.reduce((prev, next) => {
        // none of the items in the current array are the same as the other items
        for (var i = 0; i < next.length - 1; i++) {
          expect(next[i]).not.toEqual(next[i + 1]);
        }
        // none of the items are equal
        expect(prev).not.toEqual(next);
        return prev;
      }, phones.pop());
    });

    test('the content is exactly the same everytime', async () => {
      const testModel = getModel();
      let actual = [];
      const count = document.faker.random.number({ min: 10, max: 200 });
      for (var i = 0; i < count; i++) {
        document.documents = {};
        actual.push(document.build(testModel));
      }
      actual = await Promise.all(actual);

      actual.reduce((expected, next) => {
        expect(next).toEqual(expected);
        return expected;
      }, actual.pop());
    });

    test('the two items returned are always the same', async () => {
      const count = document.faker.random.number({ min: 10, max: 200 });
      const testModel = getModel();
      testModel.data.count = 1;
      for (var i = 0; i < count; i++) {
        document.documents = {};
        const actual = await document.build(testModel);
        expect(actual[0].phones).toEqual([
          { type: 'Mobile', phone_number: '505.771.2870', extension: null },
          { type: 'Mobile', phone_number: '275-728-6040', extension: null }
        ]);
      }
    });
  });
});


describe('runData', () => {
  test('function wasn\'t passed', () => {
    const tester = () => document.runData();
    expect(tester).not.toThrow();
    expect(tester()).toBe(undefined);
  });

  test('returns the context that\'s passed', () => {
    function Foo() {
      return this;
    }
    expect(document.runData(Foo, 'context')).toBe('context');
  });

  test('throws error because of something in function', () => {
    function Foo() {
      const bar = {};
      return bar.data.woohoo;
    }
    // highjack the log function
    document.log = (type, err) => {
      if (type === 'error') {
        throw err;
      }
    };
    const tester = () => document.runData(Foo, 'context');
    expect(tester).toThrow(/Foo failed, Cannot read propert(?:y|ies) (?:'woohoo' of undefined|of undefined \(reading 'woohoo'\))/);
  });
});


// not needed because it just calls other functions that have been tested
// test.todo('buildDocument');

// describe('initializeDocument', () => {
//   test('throws if wrong paths were passed in', () => {
//     // highjack the log function
//     document.log = (type, message) => {
//       if (type === 'error') {
//         throw new Error(message);
//       }
//     };
//     const tester = () => document.initializeDocument({}, { model: [ 'a' ], document: [ 'a' ] });
//     expect(tester).toThrow();
//   });

//   describe(models(async (file) => {
//     await model.registerModels(file);
//     const testModel = _.find(model.models, (obj) => {
//       return obj.file.includes(file);
//     });

//     const doc = document.initializeDocument(testModel);
//     expect(to.keys(doc)).toEqual(to.keys(testModel.properties));
//     function get(key) {
//       let result = _.get(testModel, `properties.${key}`);
//       if (!result) {
//         result = _.get(testModel, `properties.${key.split('.').join('.properties.')}`);
//       }
//       if (result) {
//         return typeToValue(result.type);
//       }
//       return null;
//     }

//     const keys = utils.getPaths(doc);

//     for (let key of keys) {
//       const expected = get(key);
//       const actual = _.get(doc, key);
//       const type = to.type(actual);
//       if (type !== 'object') {
//         if (type === 'array') {
//           expect(actual).toEqual(expected);
//         } else {
//           expect(actual).toBe(expected);
//         }
//       }
//     }
//   }).toString().match(/models\((.*?)\)/s)[1], () => {
//     // dynamic test group
//   });
// });


describe('buildObject', () => {
  const model = {
    name: 'test',
    data: {
      count: 1,
    },
    properties: {
      phone: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            data: {
              build() {
                return to.random([ 'Home', 'Work', 'Mobile', 'Main', 'Other' ]);
              }
            }
          },
          phone_number: {
            type: 'string',
            data: {
              build() {
                return '(333) 333 - 3333';
              }
            }
          }
        }
      }
    }
  };

  test('builds object', () => {
    const paths = getPaths(model);
    const doc = document.initializeDocument(model, paths);
    const actual = document.buildObject(model, to.clone(doc), paths, 1);

    const schema = is.object({
      phone: is.object({
        type: is.string(),
        phone_number: is.string().pattern(/\(333\) 333 - 3333/),
      })
    });

    const { error } = schema.validate(actual);
    if (error) {
      throw error;
    }

    expect(doc).not.toEqual(actual);
  });

  test('throws error', () => {
    const paths = getPaths(model);
    const doc = document.initializeDocument(model, paths);
    // highjack the log function
    document.log = (type, message) => {
      if (type === 'error') {
        throw new Error(message);
      }
    };

    const tester = () => document.buildObject(model, to.clone(doc), { model: [ 'a' ], document: [ 'b' ] }, 1);
    expect(tester).toThrow();
  });
});


describe('buildValue', () => {
  test('passed value', () => {
    expect(document.buildValue({}, 'value')).toBe('value');
    expect(document.buildValue({}, 1)).toBe(1);
    expect(document.buildValue({}, [ 'woohoo' ])).toEqual([ 'woohoo' ]);
    expect(document.buildValue({}, { foo: 'foo' })).toEqual({ foo: 'foo' });
  });

  describe('property.data.pre_build', () => {
    test('without passed value', () => {
      const actual = document.buildValue({
        data: { pre_build: () => 'pre_build' }
      });

      expect(actual).toBe('pre_build');
    });

    test('with passed value', () => {
      const actual = document.buildValue({
        data: { pre_build: () => 'pre_build' }
      }, 'passed value');
      expect(actual).not.toBe('passed value');
      expect(actual).toBe('pre_build');
    });
  });

  describe('property.data.value', () => {
    test('passes value', () => {
      const actual = document.buildValue({ data: { value: 'value' } });

      expect(actual).toBe('value');
    });

    test('with property.data.pre_build', () => {
      const actual = document.buildValue({
        data: {
          pre_build: () => 'pre_build',
          value: 'value',
        }
      });

      expect(actual).not.toBe('pre_build');
      expect(actual).toBe('value');
    });

    test('with property.data.build', () => {
      const actual = document.buildValue({
        data: {
          build: () => 'build',
          value: 'value',
        }
      });

      expect(actual).not.toBe('build');
      expect(actual).toBe('value');
    });

    test('with property.data.fake', () => {
      const actual = document.buildValue({
        data: {
          fake: '{{name.firstName}}',
          value: 'value',
        }
      });

      expect(actual).not.toMatch(/[A-Z]/);
      expect(actual).toBe('value');
    });

    test('with passed value', () => {
      const actual = document.buildValue({
        data: { value: 'value' }
      }, 'passed value');

      expect(actual).not.toBe('passed value');
      expect(actual).toBe('value');
    });
  });

  describe('property.data.build', () => {
    test('passes build value', () => {
      const actual = document.buildValue({
        data: { build: () => 'build' }
      });
      expect(actual).toBe('build');
    });

    test('with property.data.pre_build', () => {
      const actual = document.buildValue({
        data: {
          pre_build: () => 'pre_build',
          build: () => 'build',
        }
      });
      expect(actual).not.toBe('pre_build');
      expect(actual).toBe('build');
    });

    test('with global value set in pre_build', () => {
      const actual = document.buildValue({
        data: {
          pre_build: (context, documents, globals) => {
            globals.pre_build_global = 'pre_build_global';
          },
          build: (context, documents, globals) => globals.pre_build_global,
        }
      });

      expect(actual).toBe('pre_build_global');
    });

    test('with property.data.fake', () => {
      const actual = document.buildValue({
        data: {
          fake: '{{name.firstName}}',
          build: () => 'build',
        }
      });

      expect(actual).not.toMatch(/[A-Z]/);
      expect(actual).toBe('build');
    });

    test('with passed value', () => {
      const actual = document.buildValue({
        data: { build: () => 'build' }
      });
      expect(actual).not.toBe('passed value');
      expect(actual).toBe('build');
    });
  });

  describe('property.data.fake', () => {
    const fake = '{{name.firstName}}';
    test('passes fake value', () => {
      const actual = document.buildValue({ data: { fake } });

      expect(actual).not.toBe(fake);
      expect(actual).toMatch(/[A-Z]/);
    });

    test('with property.data.pre_build', () => {
      const actual = document.buildValue({
        data: {
          pre_build: () => 'pre_build',
          fake,
        }
      });

      expect(actual).not.toBe('pre_build');
      expect(actual).not.toBe(fake);
      expect(actual).toMatch(/[A-Z]/);
    });

    test('with passed value', () => {
      const actual = document.buildValue({
        data: { fake }
      }, 'passed value');

      expect(actual).not.toBe('passed value');
      expect(actual).not.toBe(fake);
      expect(actual).toMatch(/[A-Z]/);
    });
  });

  describe('property.items', () => {
    function items(obj) {
      return {
        type: 'array',
        items: to.extend({
          data: {
            min: 0,
            max: 0,
            count: 0,
          }
        }, obj),
      };
    }

    test('with passed value', () => {
      const actual = document.buildValue(items({
        type: 'string',
        data: {
          count: 5,
        }
      }), []);

      expect(to.type(actual)).toBe('array');
      expect(actual.length).toBe(5);
      // expect all items to be empty strings
      actual.forEach((item) => expect(item).toBe(''));
    });

    test('with property.items.data.pre_build', () => {
      const actual = document.buildValue(items({
        type: 'string',
        data: {
          count: 5,
          pre_build: () => 'pre_build',
        }
      }), []);

      expect(to.type(actual)).toBe('array');
      expect(actual.length).toBe(5);
      actual.forEach((item) => expect(item).toBe('pre_build'));
    });

    test('with property.items.data.value', () => {
      const actual = document.buildValue(items({
        type: 'string',
        data: {
          count: 5,
          value: 'value',
        }
      }), []);

      expect(to.type(actual)).toBe('array');
      expect(actual.length).toBe(5);
      actual.forEach((item) => expect(item).toBe('value'));
    });

    test('with property.items.data.build', () => {
      const actual = document.buildValue(items({
        type: 'string',
        data: {
          count: 5,
          build: () => 'build',
        }
      }), []);

      expect(to.type(actual)).toBe('array');
      expect(actual.length).toBe(5);
      actual.forEach((item) => expect(item).toBe('build'));
    });

    test('with property.items.data.fake', () => {
      const actual = document.buildValue(items({
        type: 'string',
        data: {
          count: 5,
          fake: '{{name.firstName}}',
        }
      }), []);

      expect(to.type(actual)).toBe('array');
      expect(actual.length).toBe(5);
      actual.forEach((item) => expect(item).toMatch(/[A-Z]/));
    });

    test('called multiple times returns different array lengths between min and max', () => {
      let actual = [];
      for (let i = 0; i < 10; i++) {
        const value = document.buildValue(items({
          type: 'string',
          data: {
            min: 1,
            max: 10,
            fake: '{{name.firstName}}',
          }
        }), []);
        actual.push(value);
      }

      actual.forEach((arr) => arr.forEach((item) => expect(item).toMatch(/[A-Z]/)));
      actual = actual.map((item) => item.length);
      expect(_.uniq(actual).length > 1).toBeTruthy();
    });

    test('complex array', () => {
      const actual = document.buildValue(items({
        type: 'object',
        data: { count: 5 },
        properties: {
          first_name: {
            type: 'string',
            description: 'The childs first_name',
            data: { fake: '{{name.firstName}}' },
          },
          gender: {
            type: 'string',
            description: 'The childs gender',
            data: { build: () => to.random(1, 10) >= 3 ? to.random([ 'M', 'F' ]) : null },
          },
          age: {
            type: 'integer',
            description: 'The childs age',
            data: { build: () => to.random(1, 17) },
          },
        }
      }), []);

      is.assert(actual, is.array()
        .items(is.object({
          first_name: is.string().pattern(/[A-Z][a-zA-Z\s]+/),
          gender: [ is.string().pattern(/M|F/), is.allow(null) ],
          age: is.number().min(1).max(17),
        }))
        .length(5));
    });
  });
});


describe('postProcess', () => {
  const model = {
    name: 'test',
    type: 'object',
    data: {
      count: 1,
    },
    properties: {
      nochanges: {
        type: 'string',
        data: {
          value: 'woohoo',
          post_build() {
            // since this is returning undefined it will not change `nochange`
            return;
          },
        },
      },
      changes: {
        type: 'string',
        data: {
          value: 'woohoo',
          post_build() {
            return to.upperCase(this.changes);
          },
        },
      },
      emails: {
        type: 'array',
        items: {
          type: 'string',
          data: {
            count: to.random(1, 4),
            build() {
              return `${to.random([ 'one', 'two', 'three', 'four' ])}@example.com`;
            },
            post_build() {
              let str = this.split('@');
              str[0] = to.upperCase(str[0]);
              return str.join('@');
            }
          }
        }
      },
      phones: {
        type: 'array',
        items: {
          type: 'object',
          data: {
            count: to.random(1, 4),
            post_build() {
              return;
            }
          },
          properties: {
            type: {
              type: 'string',
              data: {
                build() {
                  return to.random([ 'home', 'work', 'mobile', 'main', 'other' ]);
                },
                post_build() {
                  return to.titleCase(this.type);
                }
              }
            },
            extension: {
              type: 'string',
              data: {
                build() {
                  return '10';
                },
                post_build() {
                  // since this is returning undefined it will not change the extention
                  return;
                }
              }
            },
            phone_number: {
              type: 'string',
              data: {
                build() {
                  return '3333333333';
                },
                post_build() {
                  return this.phone_number.replace(/([0-9]{3})([0-9]{3})([0-9]{4})/, '($1) $2 - $3');
                }
              }
            }
          }
        }
      }
    }
  };

  test('post processes values', () => {
    const paths = getPaths(model);
    let doc = document.initializeDocument(model, paths);
    doc = document.buildObject(model, doc, paths, 1);
    const actual = document.postProcess(model, to.clone(doc), paths);
    const schema = is.object({
      nochanges: is.string().lowercase(),
      changes: is.string().uppercase(),
      emails: is.array()
        .items(is.string().pattern(/[A-Z]+@example\.com/))
        .min(1)
        .max(4),
      phones: is.array()
        .items(is.object({
          type: is.string(),
          extension: is.string().pattern(/10/),
          phone_number: is.string().pattern(/\(333\) 333 - 3333/),
        }))
        .min(1)
        .max(4),
    });

    expect(doc.changes).toMatch(/[a-z]+/);
    expect(actual.changes).toMatch(/[A-Z]+/);
    is.assert(actual, schema);
    expect(doc).not.toEqual(actual);
  });

  test('throws error', () => {
    const paths = getPaths(model);
    let doc = document.initializeDocument(model, paths);
    doc = document.buildObject(model, doc, paths, 1);
    // highjack the log function
    document.log = (type, message) => {
      if (type === 'error') {
        throw new Error(message);
      }
    };

    const tester = () => document.postProcess(model, to.clone(doc), { model: [ 'a' ], document: [ 'b' ] }, 1);
    expect(tester).toThrow();
  });
});


describe('transformValueToType', () => {
  const tests = [
    {
      actual: [ null, 'woohoo' ],
      expected: 'woohoo',
    },
    {
      actual: [ 'number', null ],
      expected: null,
    },
    {
      actual: [ 'number', undefined ],  
      expected: undefined,
    },
    {
      actual: [ 'array', [ 'one', 'two', 'three' ] ],
      expected: [ 'one', 'two', 'three' ],
    },
    {
      actual: [ 'number', '100' ],
      expected: 100,
    },
    {
      actual: [ 'integer', '100' ],
      expected: 100,
    },
    {
      actual: [ 'long', '100' ],
      expected: 100,
    },
    {
      actual: [ 'double', '0.0100000' ],
      expected: 0.01,
    },
    {
      actual: [ 'float', '000000.01' ],
      expected: 0.01,
    },
    {
      actual: [ 'float', '000000.01' ],
      expected: 0.01,
    },
    {
      actual: [ 'string', 'woohoo' ],
      expected: 'woohoo',
    },
    {
      actual: [ 'string', {} ],
      expected: '[object Object]',
    },
    {
      actual: [ 'boolean', false ],
      expected: false,
    },
    {
      actual: [ 'boolean', true ],
      expected: true,
    },
    {
      actual: [ 'boolean', 'false' ],
      expected: false,
    },
    {
      actual: [ 'bool', '0' ],
      expected: false,
    },
    {
      actual: [ 'bool', 'undefined' ],
      expected: false,
    },
    {
      actual: [ 'bool', 'null' ],
      expected: false,
    },
    {
      actual: [ 'object', {} ],
      expected: {},
    },
  ];

  tests.forEach(({ actual, expected }) => {
    let value = actual[1];
    if (to.type(value) === 'object') {
      value = '{}';
    } else if (to.type(value) === 'array') {
      value = `[ '${value.join('\', \'')}' ]`;
    }
    test(`type is \`${actual[0]}\` and value is \`${value}\``, () => {
      if ('array,object'.includes(to.type(expected))) {
        expect(transformValueToType(...actual)).toEqual(expected);
      } else {
        expect(transformValueToType(...actual)).toBe(expected);
      }
    });
  });
});


describe('getPaths', models(async (file) => {
  await model.registerModels(file);
  const testModel = _.find(model.models, (obj) => {
    return obj.file === p(documents_root, file);
  });
  const paths = getPaths(testModel);

  expect(to.type(paths)).toBe('object');
  expect(to.keys(paths)).toEqual([ 'model', 'document' ]);
  expect(paths.model.join(',').includes('items.properties')).toBeFalsy();
  expect(paths.document.join(',').includes('properties.')).toBeFalsy();
  expect(paths.model.length).toBe(paths.document.length);
}));


describe('typeToValue', () => {
  const tests = [
    { actual: 'string', expected: '' },
    { actual: 'object', expected: {} },
    { actual: 'structure', expected: {} },
    { actual: 'number', expected: 0 },
    { actual: 'integer', expected: 0 },
    { actual: 'double', expected: 0 },
    { actual: 'long', expected: 0 },
    { actual: 'float', expected: 0 },
    { actual: 'array', expected: [] },
    { actual: 'boolean', expected: false },
    { actual: 'bool', expected: false },
    { actual: 'null', expected: null },
    { actual: 'undefined', expected: null },
  ];

  tests.forEach(({ actual, expected }) => {
    test(actual, () => {
      if ('object,structure,array'.includes(actual)) {
        expect(typeToValue(actual)).toEqual(expected);
      } else {
        expect(typeToValue(actual)).toBe(expected);
      }
    });
  });
});

});

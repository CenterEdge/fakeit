 import path, { join as p } from 'path';
import { describe, expect, test, beforeEach, afterAll } from '@jest/globals';
import fs from 'fs-extra-promisify';
import {
  objectSearch,
  findFiles,
  readFiles,
  pool,
  parsers,
} from '../app/utils';
import { startCapturing, stopCapturing } from './console';
import { map } from 'async-array-methods';
import to from 'to-js';
import AdmZip from 'adm-zip';
import _ from 'lodash';

async function touch(...files) {
  return map(to.flatten(files), (file) => {
    if (file.path) {
      return fs.outputFile(file.path, file.content);
    }
    return fs.ensureFile(file);
  });
}

const utils_root = p(__dirname, 'fixtures', 'utils');

describe('utils:', () => {
  describe('objectSearch', () => {
    const obj = {
      one: {
        two: {
          three: 'woohoo'
        }
      }
    };

    test('no pattern', () => {
      const actual = objectSearch(obj);
      expect(actual.length).toBe(3);
      expect(actual).toEqual([ 'one', 'one.two', 'one.two.three' ]);
    });

    test('match first instance of `one`', () => {
      const actual = objectSearch(obj, /^one$/);
      expect(actual.length).toBe(1);
      expect(actual).toEqual([ 'one' ]);
    });

    test('match first instance of `two`', () => {
      const actual = objectSearch(obj, /^.*two$/);
      expect(actual.length).toBe(1);
      expect(actual).toEqual([ 'one.two' ]);
    });

    test('match first instance of `two`', () => {
      const arr = [ obj, obj ];
      const actual = objectSearch(arr, /^.*two$/);
      expect(actual.length).toBe(2);
      expect(actual).toEqual([ '0.one.two', '1.one.two' ]);
      // ensure it works with lodash get method
      expect(_.get(arr, actual[0])).toEqual({ three: 'woohoo' });
    });

    test('match first instance of `two`', () => {
      const arr = [ obj, obj ];
      const actual = objectSearch(arr, /^[0-9]$/);
      expect(actual.length).toBe(2);
      expect(actual).toEqual([ '0', '1' ]);
      // ensure it works with lodash get method
      expect(_.get(arr, actual[0])).toEqual(obj);
    });
  });

  describe('findFiles', () => {
    const root = p(utils_root, 'find-files');
    const files = [
      p(root, 'file-1.js'),
      p(root, 'one', 'file.js'),
      p(root, 'one', 'two', 'file.js'),
      p(root, 'one', 'two', 'three', 'file.js'),
      p(root, 'one', 'two', 'three', 'four', 'file.js'),
    ];

    beforeEach(async () => {
      await fs.remove(root);
      await touch(files);
    });

    test('pass a dir', async () => {
      const actual = await findFiles(root);
      expect(actual.length).toBe(5);
      expect(actual.map(f => path.normalize(f))).toEqual(files);
    });

    test('pass a glob', async () => {
      const actual = await findFiles(p(root, '*.js'));
      expect(actual.length).toBe(1);
      expect(actual.map(f => path.normalize(f))).toEqual(files.slice(0, 1));
    });

    test('pass a file', async () => {
      const actual = await findFiles(p(root, 'file-1.js'));
      expect(actual.length).toBe(1);
      expect(actual).toEqual(files.slice(0, 1));
    });

    afterAll(() => fs.remove(root));
  });

  describe('readFiles', () => {
    const root = p(utils_root, 'read-files');
     
    const plain_files = [
      { path: p('file-1.txt'), content: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Doloremque qui itaque assumenda expedita a unde illum facere laborum, quaerat, ipsam error facilis ipsum quasi et, id deleniti placeat pariatur quia!' },
      { path: p('one', 'file.txt'), content: 'Et fuga in, necessitatibus ipsum tempore! Libero pariatur et nihil impedit quasi, saepe, vero facere aspernatur asperiores laudantium fugiat! Quibusdam modi, soluta assumenda, veritatis cumque dolorum tempore excepturi voluptate! Fugit?' },
      { path: p('one', 'two', 'file.txt'), content: 'Harum asperiores, dignissimos esse, quibusdam veritatis nihil velit ipsa maiores quos natus officia enim laboriosam atque odio quod! Sed quod temporibus amet doloremque modi sequi quisquam quidem, neque debitis magnam!' },
      { path: p('one', 'two', 'three', 'file.txt'), content: 'Blanditiis iure nihil nam. Debitis, commodi beatae. Praesentium at, blanditiis libero ipsum consectetur illo debitis odit, nemo, cupiditate modi quod veritatis aliquam accusamus facilis quos, vero dolorum adipisci quis hic.' },
      { path: p('one', 'two', 'three', 'four', 'file.txt'), content: 'Beatae dolores porro culpa sit! Ipsam suscipit quaerat tenetur iure officiis. Asperiores optio, omnis hic exercitationem doloribus adipisci nesciunt voluptates consequuntur. Nihil veniam et, quas minima autem dolore aspernatur saepe.' },
    ];
    const root_plain_files = to.clone(plain_files).map((file) => {
      file.path = p(root, file.path);
      return file;
    });

    // creating archives
    const zip_file = p(root, 'zip-test.zip');

    beforeEach(async () => {
      await fs.remove(root);
      await touch(root_plain_files);
      const zip = new AdmZip();
      plain_files.forEach((file) => {
        zip.addFile(file.path, file.content);
      });
      zip.writeZip(zip_file);
    });

    test('single file', async () => {
      const file = root_plain_files[0];
      const actual = await readFiles(file.path);
      expect(actual.length).toBe(1);
      expect(to.type(actual)).toBe('array');
      expect(to.type(actual[0])).toBe('object');
    });

    test('plain files', async () => {
      const actual = await readFiles(root_plain_files.map((obj) => obj.path));
      expect(actual.length).toBe(5);
      expect(to.type(actual)).toBe('array');
      expect(to.type(actual[0])).toBe('object');
      expect(to.keys(actual[0])).toEqual([ ...to.keys(path.parse(root_plain_files[0].path)), 'path', 'content' ]);
      for (let i = 0; i < root_plain_files.length; i++) {
        let plain_file = root_plain_files[i];
        let actual_file = actual[i];
        expect(actual_file.path).toBe(plain_file.path);
        expect(actual_file.content).toBe(plain_file.content);
      }
    });

    test('zip file only', async () => {
      const actual = await readFiles(zip_file);
      expect(actual.length).toBe(5);
      expect(to.type(actual)).toBe('array');
      expect(to.type(actual[0])).toBe('object');
      expect(to.keys(actual[0])).toEqual([ ...to.keys(path.parse(plain_files[0].path)), 'path', 'content' ]);
      for (let i = 0; i < plain_files.length; i++) {
        let plain_file = plain_files[i];
        let actual_file = actual[i];
        expect(actual_file.path).toBe(plain_file.path);
        expect(actual_file.content).toBe(plain_file.content);
      }
    });

    afterAll(() => fs.remove(root));
  });

  describe('pool', () => {
    const delay = (duration) => {
      duration *= 100;
      return new Promise((resolve) => {
        console.log(`${duration} start`);
        setTimeout(() => {
          console.log(`${duration} end`);
          resolve();
        }, duration);
      });
    };
    const items = [ 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten' ];
    
    test('no limit', async () => {
      startCapturing();
      let result = pool(items, async (item, i, array) => {
        expect(array).toEqual(items);
        expect(typeof i).toBe('number');
        await delay(i);
        return `woohoo ${item}`;
      });
      expect(typeof result.then).toBe('function');
      result = await result;
      const consoleOutput = stopCapturing();
      expect(result).not.toEqual(items);
      expect(result).toEqual(items.map((item) => `woohoo ${item}`));
      expect(consoleOutput.join('\n').split('\n').filter(Boolean)).toEqual([
        '0 start',
        '100 start',
        '200 start',
        '300 start',
        '400 start',
        '500 start',
        '600 start',
        '700 start',
        '800 start',
        '900 start',
        '0 end',
        '100 end',
        '200 end',
        '300 end',
        '400 end',
        '500 end',
        '600 end',
        '700 end',
        '800 end',
        '900 end',
      ]);
    });

    test('limit 3', async () => {
      startCapturing();
      let result = pool(items, async (item, i, array) => {
        expect(array).toEqual(items);
        expect(typeof i).toBe('number');
        await delay(i);
        return `woohoo ${item}`;
      }, 3);
      expect(typeof result.then).toBe('function');
      result = await result;
      const consoleOutput = stopCapturing();
      expect(result).not.toEqual(items);
      expect(result).toEqual(items.map((item) => `woohoo ${item}`));
      expect(consoleOutput.join('\n').split('\n').filter(Boolean)).toEqual([
        '0 start',
        '100 start',
        '200 start',
        '0 end',
        '300 start',
        '100 end',
        '400 start',
        '200 end',
        '500 start',
        '300 end',
        '600 start',
        '400 end',
        '700 start',
        '500 end',
        '800 start',
        '600 end',
        '900 start',
        '700 end',
        '800 end',
        '900 end'
      ]);
    });
  });

  describe('parsers', () => {
    const expected = {
      _id: 'airport_56',
      airport_id: 56,
      doc_type: 'airport',
      airport_ident: 'AYGA',
      airport_type: 'medium_airport',
      airport_name: 'Goroka',
      geo: {
        latitude: -6.081689835,
        longitude: 145.3919983
      },
      elevation: 5282,
      iso_continent: 'OC',
      iso_country: 'PG',
      iso_region: 'PG-EHG',
      municipality: 'Goroka',
      airport_icao: 'AYGA',
      airport_iata: 'GKA',
      airport_gps_code: 'AYGA',
      timezone_offset: 10,
      dst: 'U',
      timezone: 'Pacific/Port_Moresby'
    };

    // stores the tests for each of the parsers
    const tests = {};
     
    tests.yaml = tests.yml = `
      _id: airport_56
      airport_id: 56
      doc_type: airport
      airport_ident: AYGA
      airport_type: medium_airport
      airport_name: Goroka
      geo:
        latitude: -6.081689835
        longitude: 145.3919983
      elevation: 5282
      iso_continent: OC
      iso_country: PG
      iso_region: PG-EHG
      municipality: Goroka
      airport_icao: AYGA
      airport_iata: GKA
      airport_gps_code: AYGA
      timezone_offset: 10
      dst: U
      timezone: Pacific/Port_Moresby
    `;

     
    tests.json = {
      "_id": "airport_56",
      "airport_id": 56,
      "doc_type": "airport",
      "airport_ident": "AYGA",
      "airport_type": "medium_airport",
      "airport_name": "Goroka",
      "geo": {
        "latitude": -6.081689835,
        "longitude": 145.3919983
      },
      "elevation": 5282,
      "iso_continent": "OC",
      "iso_country": "PG",
      "iso_region": "PG-EHG",
      "municipality": "Goroka",
      "airport_icao": "AYGA",
      "airport_iata": "GKA",
      "airport_gps_code": "AYGA",
      "timezone_offset": 10,
      "dst": "U",
      "timezone": "Pacific/Port_Moresby"
    };

     

    tests.cson = `
      _id: "airport_56"
      airport_id: 56
      doc_type: "airport"
      airport_ident: "AYGA"
      airport_type: "medium_airport"
      airport_name: "Goroka"
      geo:
        latitude: -6.081689835
        longitude: 145.3919983
      elevation: 5282
      iso_continent: "OC"
      iso_country: "PG"
      iso_region: "PG-EHG"
      municipality: "Goroka"
      airport_icao: "AYGA"
      airport_iata: "GKA"
      airport_gps_code: "AYGA"
      timezone_offset: 10
      dst: "U"
      timezone: "Pacific/Port_Moresby"
    `;

    tests.csv = `
      "_id","airport_id","doc_type","airport_ident","airport_type","airport_name","geo","elevation","iso_continent","iso_country","iso_region","municipality","airport_icao","airport_iata","airport_gps_code","timezone_offset","dst","timezone"
      "airport_56",56,"airport","AYGA","medium_airport","Goroka","{""latitude"":-6.081689835,""longitude"":145.3919983}",5282,"OC","PG","PG-EHG","Goroka","AYGA","GKA","AYGA",10,"U","Pacific/Port_Moresby"
    `;

     
    // stores the available parsers that should exist
    const available = to.keys(tests);

    // generate tests for each parser in the list
    for (var parser in parsers) {
      if (Object.prototype.hasOwnProperty.call(parsers, parser)) {
        parserTest(parser);
      }
    }

    function parserTest(name) {
      describe(name, () => {
        const parser = parsers[name];
        let content = tests[name];
        if (name === 'json') {
          content = JSON.stringify(content, null, 2);
        } else {
          content = to.normalize(tests[name]);
        }
        test('exists', () => {
          expect(available.includes(name)).toBeTruthy();
        });

        test('general', () => {
          expect(to.type(parser)).toBe('object');
          expect(to.type(parser.parse)).toMatch(/function$/);
          expect(to.type(parser.stringify)).toMatch(/function$/);
          for (let fn in parser) {
            if (Object.prototype.hasOwnProperty.call(parser, fn)) {
              expect([ 'parse', 'stringify' ].includes(fn)).toBeTruthy();
            }
          }
        });

        test('parse', async () => {
          let result = parser.parse(content);
          expect(to.type(result.then)).toBe('function');

          result = await result;

          if (name === 'csv') {
            expect(to.type(result)).toBe('array');
            result = result[0];
          } else {
            expect(to.type(result)).toBe('object');
          }

          expect(result).toEqual(expected);
        });

        test('stringify', async () => {
          let result = parser.stringify(expected);
          expect(to.type(result.then)).toBe('function');
          result = await result;
          expect(result).toEqual(content);
        });
      });
    }
  });
});

 

import Zip from '../../app/output/zip';
import { join as p } from 'path';
import fs from 'fs-extra-promisify';
import default_options from '../../app/output/default-options';
import to from '../../app/to.js';
import { describe, expect, test, beforeEach, afterAll } from '@jest/globals';

fs.exists = async (str) => {
  try {
    await fs.stat(str);
    return true;
  } catch {
    return false;
  }
};

const zip_root = p(__dirname, '..', 'fixtures', 'output', 'zip');
default_options.root = zip_root;

describe('output:zip', () => {
  let context;

  beforeEach(() => {
    context = new Zip({ root: zip_root });
  });

  test('without args', () => {
    expect(context.output_options).toEqual(default_options);
    expect(context.prepared).toBe(false);
    expect(typeof context.prepare).toBe('function');
    expect(typeof context.output).toBe('function');
  });

  test('prepare', async () => {
    expect(context.prepared).toBe(false);
    expect(context.preparing).toBeUndefined();  
    const preparing = context.prepare();
    expect(typeof context.preparing.then).toBe('function');
    expect(context.prepared).toBe(false);
    await preparing;
    expect(typeof context.zip).toBe('object');
    expect(context.prepared).toBe(true);
  });

  test('setup', async () => {
    expect(context.prepared).toBe(false);
    expect(context.preparing).toBeUndefined();  
    const preparing = context.setup();
    expect(typeof context.preparing.then).toBe('function');
    expect(context.prepared).toBe(false);
    await preparing;
    expect(typeof context.zip).toBe('object');
    expect(context.prepared).toBe(true);
  });

  // These tests must be run in order since they're testing the console output.
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

  describe('output', () => {
    for (let language of to.keys(languages)) {
      const data = languages[language];
      test(`${language}`, async () => {
        expect(context.prepared).toBe(false);
        context.output_options.output = 'folder';
        context.output_options.format = language;
        expect(context.preparing).toBeUndefined();  
        await context.output('woohoo', data);
        expect(context.zip.getEntries()[0].name).toBe(`woohoo.${language}`);
        expect(context.prepared).toBe(true);
      });
    }
  });

  describe('finalize', () => {
    for (let language of to.keys(languages)) {
      const data = languages[language];
      test(`${language}`, async () => {
        expect(context.prepared).toBe(false);
        context.output_options.output = zip_root;
        context.output_options.archive = `${language}.zip`;
        context.output_options.format = language;
        expect(context.preparing).toBeUndefined();  
        await context.output('woohoo', data);
        expect(context.zip.getEntries()[0].name).toBe(`woohoo.${language}`);
        expect(context.prepared).toBe(true);
        await context.finalize();
        expect(await fs.exists(p(zip_root, context.output_options.archive))).toBe(true);
      });
    }
  });

  afterAll(() => fs.remove(zip_root));
});

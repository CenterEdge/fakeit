 

import Console from '../../app/output/console';
import default_options from '../../app/output/default-options';
import to from 'to-js';
import { stripColor } from 'chalk';
import { describe, expect, test, beforeEach } from '@jest/globals';

describe('output:console', () => {
  let output;

  beforeEach(() => {
    output = new Console();
  });

  test('without args', () => {
    expect(output.output_options).toEqual(default_options);
    expect(output.prepared).toBe(false);
    expect(typeof output.prepare).toBe('function');
    expect(typeof output.output).toBe('function');
  });

  test('prepare', async () => {
    expect(output.prepared).toBe(false);
    expect(output.preparing).toBeUndefined();  
    const preparing = output.prepare();
    expect(typeof output.preparing.then).toBe('function');
    expect(output.prepared).toBe(false);
    await preparing;
    expect(output.prepared).toBe(true);
  });

  test('setup', async () => {
    expect(output.prepared).toBe(false);
    expect(output.preparing).toBeUndefined();  
    const preparing = output.setup();
    expect(typeof output.preparing.then).toBe('function');
    expect(output.prepared).toBe(false);
    await preparing;
    expect(output.prepared).toBe(true);
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
      test(`${language}`, async () => {
        output.output_options.format = language;
        expect(output.prepared).toBe(false);
        expect(output.preparing).toBeUndefined();  
        const actual = await output.output(null, data);
        expect(output.prepared).toBe(true);
        expect(actual.trim()).not.toBe(data);
        if (language !== 'csv') {
          expect(stripColor(actual).trim()).toBe(data);
        } else {
          expect(stripColor(actual).trim()).not.toBe(data);
        }
      });
    }
  });
});

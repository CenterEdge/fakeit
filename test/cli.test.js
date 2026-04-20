import { describe, expect, test, beforeAll, afterAll, jest } from '@jest/globals';
import { join as p } from 'path';
import to from '../app/to.js';
import fs from 'fs-extra-promisify';
import { execSync } from 'child_process';
import chalk, { stripColor } from 'chalk';
import cli, { code, dim } from '../app/cli.js';
import Fakeit from '../app/index.js';
import _ from 'lodash';

const modelsRoot = p(__dirname, 'fixtures', 'models');
const binPath = p(__dirname, '..', 'bin', 'fakeit');

// Strip ANSI escape codes from a string.
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

// Capture the last console.log call made during fn(), suppressing all output.
async function captureConsoleOutput(fn) {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await fn();
    const calls = consoleSpy.mock.calls;
    return calls.length > 0 ? stripAnsi(String(calls[calls.length - 1][0] ?? '')) : '';
  } finally {
    consoleSpy.mockRestore();
  }
}

describe('cli:', () => {


  test('cli is the default function', () => {
    expect(typeof cli).toBe('function');
  });


  describe('console', () => {
    const expected_keys = [
      'id',
      'type',
      'user_id',
      'first_name',
      'last_name',
      'email_address',
      'phone',
      'active',
      'created_on'
    ];

    const expected_abc_seed = {
      _id: 'contact_71d54ed1-2db6-55a0-985d-a989535c8c62',
      doc_type: 'contact',
      contact_id: '71d54ed1-2db6-55a0-985d-a989535c8c62',
      details: { prefix: null, first_name: 'Daphnee', middle_name: 'Carrie', last_name: 'O\'Hara', company: 'Hackett - Effertz', job_title: null, nickname: null },
      phones: [ { type: 'Mobile', phone_number: '076-099-8620', extension: null } ],
      emails: [ 'Robb_Vandervort@hotmail.com' ],
      addresses: [ { type: 'Other', address_1: '81647 Electa Island Inlet', address_2: null, locality: 'North Abigaletown', region: 'LA', postal_code: '12411', country: 'JO' } ],
      children: [ { first_name: 'Chris', gender: null, age: 12 }, { first_name: 'Travis', gender: null, age: 6 } ],
      notes: 'Quod aliquid molestias modi possimus neque assumenda impedit.',
      tags: [ 'hard drive', 'neural', 'Computer', 'adapter' ]
    };

    test("--count 1 'simple/models/*'", async () => {
      const stdout = await captureConsoleOutput(async () => {
        const fakeit = new Fakeit({ root: modelsRoot, count: 1, log: false });
        await fakeit.generate([ 'simple/models/*' ], { output: 'console' });
      });
      const data = to.object(stdout);
      expect(to.type(data)).toBe('array');
      expect(data.length).toBe(1);
      expect(to.keys(data[0])).toEqual(expected_keys);
    });

    test("--count 1 'simple/models/*' --format 'csv'", async () => {
      const stdout = await captureConsoleOutput(async () => {
        const fakeit = new Fakeit({ root: modelsRoot, count: 1, log: false });
        await fakeit.generate([ 'simple/models/*' ], { output: 'console', format: 'csv' });
      });
      const lines = stdout.split('\n');
      expect(lines[0]).toMatch(/^[┌─┬┐]+$/);
      expect(lines[2]).toMatch(/^[├─┼┤]+$/);
      expect(lines[4]).toMatch(/^[└─┴┘]+$/);
      expect(lines[1].slice(1, -1).trim().split(/\s*│\s*/g)).toEqual(expected_keys);
      expect(lines[3].slice(1, -1).trim().split(/\s*│\s*/g).length).toBe(9);
    });

    test("'simple/models/*' --format 'csv' --count 1 --no-highlight", async () => {
      const stdout = await captureConsoleOutput(async () => {
        const fakeit = new Fakeit({ root: modelsRoot, count: 1, log: false });
        await fakeit.generate([ 'simple/models/*' ], { output: 'console', format: 'csv', highlight: false });
      });
      const lines = stdout.split('\n');
      expect(lines[0]).toBe('"id","type","user_id","first_name","last_name","email_address","phone","active","created_on"');
      expect(lines[0].replace(/"/g, '').split(',')).toEqual(expected_keys);
    });

    test('contacts/models/contacts.yaml --count 1 --seed abc', async () => {
      const stdout = await captureConsoleOutput(async () => {
        const fakeit = new Fakeit({ root: modelsRoot, count: 1, seed: 'abc', log: false });
        await fakeit.generate([ 'contacts/models/contacts.yaml' ], { output: 'console' });
      });
      const data = to.object(stdout);
      expect(to.type(data)).toBe('array');
      expect(data.length).toBe(1);

      // remove the dates because they can't be correct
      let result = _.omit(data[0], [ 'created_on', 'modified_on' ]);
      result.details = _.omit(result.details, [ 'dob' ]);
      expect(result).toEqual(expected_abc_seed);
    });

    test('contacts/models/contacts.yaml --count 1 --seed 123456789', async () => {
      const stdout = await captureConsoleOutput(async () => {
        const fakeit = new Fakeit({ root: modelsRoot, count: 1, seed: 123456789, log: false });
        await fakeit.generate([ 'contacts/models/contacts.yaml' ], { output: 'console' });
      });
      const data = to.object(stdout);
      expect(to.type(data)).toBe('array');
      expect(data.length).toBe(1);

      let result = _.omit(data[0], [
        // remove the dates because they can't be correct
        'created_on',
        'modified_on',
        // These values are hard coded and never change so they should be the same
        'doc_type',
        'channels',
      ]);
      // removed the dob because it's a date
      result.details = _.omit(result.details, [ 'dob' ]);

      for (let key in result) {
        if (Object.prototype.hasOwnProperty.call(result, key)) {
          const value = result[key];
          const not_expected = expected_abc_seed[key];
          // it's a different key so it should be different
          expect(value).not.toEqual(not_expected);
        }
      }
    });
  });


  describe('directory|folder', () => {
    const root = p(__dirname, 'directory-cli-test');
    const expected_keys = [
      'id',
      'type',
      'user_id',
      'first_name',
      'last_name',
      'email_address',
      'phone',
      'active',
      'created_on'
    ];

    beforeAll(async () => {
      await fs.remove(root);
      await fs.ensureDir(root);
    });

    test('output files to directory', async () => {
      const outputDir = p(root, 'directory-test');
      const file = p(outputDir, 'user_0.json');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const fakeit = new Fakeit({ root: modelsRoot, count: 1, log: false });
        await fakeit.generate([ 'simple/models/users.yaml' ], { output: outputDir });
      } finally {
        consoleSpy.mockRestore();
      }
      expect(await fs.pathExists(file)).toBe(true);
      const content = await fs.readFile(file, 'utf8');
      expect(content).toMatch(new RegExp(`"${expected_keys.join('|')}":`, 'g'));
    });

    test('zip output by passing in as the file.zip', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const fakeit = new Fakeit({ root: modelsRoot, count: 1, log: false });
        await fakeit.generate([ 'simple/models/users.yaml' ], { output: root, archive: 'zip-test.zip' });
      } finally {
        consoleSpy.mockRestore();
      }
      expect(await fs.pathExists(p(root, 'zip-test.zip'))).toBe(true);
    });

    test('zip output by passing in --archive as an option', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const fakeit = new Fakeit({ root: modelsRoot, count: 1, log: false });
        await fakeit.generate([ 'simple/models/users.yaml' ], { output: p(root, 'zip-test'), archive: 'archive.zip' });
      } finally {
        consoleSpy.mockRestore();
      }
      expect(await fs.pathExists(p(root, 'zip-test', 'archive.zip'))).toBe(true);
    });

    afterAll(() => fs.remove(root));
  });

  test('throws error when something goes wrong', async () => {
    await expect(async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      try {
        const fakeit = new Fakeit({ root: modelsRoot, count: 1, log: false });
        await fakeit.generate([ 'simple/models/*' ], { output: 'error-test', archive: 'woohoo' });
      } finally {
        consoleSpy.mockRestore();
        stdoutSpy.mockRestore();
      }
    }).rejects.toThrow(/The archive file must have a file extention of `\.zip`/);
  });

  describe('help', () => {
    test('help as argument', () => {
      const output = execSync(`node "${binPath}" help`, {
        cwd: modelsRoot,
        encoding: 'utf8',
      });
      expect(output).toMatch(/^\s*Usage: fakeit \[command\] \[<file\|directory\|glob> \.\.\.\]/);
    });

    test('no arguments were passed', () => {
      const output = execSync(`node "${binPath}"`, {
        cwd: modelsRoot,
        encoding: 'utf8',
      });
      expect(output).toMatch(/^\s*Usage: fakeit \[command\] \[<file\|directory\|glob> \.\.\.\]/);
    });

    test('console action with no model arguments', () => {
      const output = execSync(`node "${binPath}" console`, {
        cwd: modelsRoot,
        encoding: 'utf8',
      });
      expect(output).toMatch(/^.*warning.*:\s+you must pass in models to use/);
    });
  });

  test('code', () => {
    const wasEnabled = chalk.enabled;
    chalk.enabled = true;
    try {
      expect(code('one')).toBe('\u001b[1mone\u001b[22m');
      expect(stripColor(code('one', 'two', 'three')).split(/\s*,\s*/)).toEqual([ 'one', 'two', 'three' ]);
    } finally {
      chalk.enabled = wasEnabled;
    }
  });

  test('dim', () => {
    const wasEnabled = chalk.enabled;
    chalk.enabled = true;
    try {
      expect(dim('one')).toBe('\u001b[2mone\u001b[22m');
      expect(stripColor(dim('one', 'two', 'three')).split(/\s*,\s*/)).toEqual([ 'one', 'two', 'three' ]);
    } finally {
      chalk.enabled = wasEnabled;
    }
  });
});


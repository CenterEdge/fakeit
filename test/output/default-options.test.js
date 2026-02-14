import { describe, expect, test } from '@jest/globals';
import default_options from '../../app/output/default-options';

describe('output:default-options', () => {
  test('default options values', () => {
    expect(default_options).toEqual({
      format: 'json',
      spacing: 2,
      output: 'return',
      limit: 10,
      highlight: true,
      archive: '',
      server: '127.0.0.1',
      bucket: 'default',
      username: '',
      password: '',
      timeout: 5000,
    });
  });
});

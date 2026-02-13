import { describe, expect, test } from '@jest/globals';
import { join as p } from 'path';
import Base from '../app/base';

test('without args', () => {
  const base = new Base();
  expect(base).toEqual(expect.objectContaining({
    // inherited from events-async
    _events: {},
    _eventsCount: 0,
    _maxListeners: 50,

    options: {
      root: process.cwd(),
      log: true,
      verbose: false,
      spinners: true,
      timestamp: true,
    },
    log_types: {
      error: 'red',
      warning: 'yellow',
      success: 'green',
      info: 'blue',
      verbose: 'magenta',
      log: 'gray',
    },
    spinners: {},
  }));
});


test('with args', () => {
  const base = new Base({ log: false });
  expect(base).toEqual(expect.objectContaining({
    // inherited from events-async
    _events: {},
    _eventsCount: 0,
    _maxListeners: 50,

    options: {
      root: process.cwd(),
      log: false,
      verbose: false,
      spinners: false,
      timestamp: true,
    },
    log_types: {
      error: 'red',
      warning: 'yellow',
      success: 'green',
      info: 'blue',
      verbose: 'magenta',
      log: 'gray',
    },
    spinners: {},
  }));
});

test('when options.verbose is true, it forces options.log to also be true', () => {
  const base = new Base({
    log: false,
    verbose: true,
  });
  expect(base).toHaveProperty('options.log', true);
  expect(base).toHaveProperty('options.verbose', true);
});

describe('functions', () => {
  describe('resolvePaths', () => {
    function paths(prefix = process.cwd()) {
      return [ 'one', 'two', 'three', 'four' ].map((str) => p(prefix, str));
    }

    test('no args', () => {
      const base = new Base();
      expect(base.resolvePaths()).toEqual([]);
    });

    test('passed a string with 1 path', () => {
      const base = new Base();
      expect(base.resolvePaths('one')).toEqual([ p(process.cwd(), 'one') ]);
    });

    test('passed a string with multiple paths as a comma delimited list without spaces', () => {
      const [ one, two, three, four ] = paths();
      const base = new Base();
      expect(base.resolvePaths('one,two')).toEqual([ one, two ]);
      expect(base.resolvePaths('one,two,three')).toEqual([ one, two, three ]);
      expect(base.resolvePaths('one,two,three,four')).toEqual([ one, two, three, four ]);
    });

    test('passed a string with multiple paths as a comma delimited list with spaces', () => {
      const [ one, two, three, four ] = paths();
      const base = new Base();
      expect(base.resolvePaths('one, two')).toEqual([ one, two ]);
      expect(base.resolvePaths('one ,two')).toEqual([ one, two ]);
      expect(base.resolvePaths('one , two')).toEqual([ one, two ]);
      expect(base.resolvePaths('one, two, three')).toEqual([ one, two, three ]);
      expect(base.resolvePaths('one ,two ,three')).toEqual([ one, two, three ]);
      expect(base.resolvePaths('one , two , three')).toEqual([ one, two, three ]);
      expect(base.resolvePaths('one, two, three, four')).toEqual([ one, two, three, four ]);
      expect(base.resolvePaths('one ,two ,three ,four')).toEqual([ one, two, three, four ]);
      expect(base.resolvePaths('one , two , three , four')).toEqual([ one, two, three, four ]);
    });

    test('passed a string with multiple paths as a space delimited list', () => {
      const [ one, two, three, four ] = paths();
      const base = new Base();
      expect(base.resolvePaths('one two')).toEqual([ one, two ]);
      expect(base.resolvePaths('one        two')).toEqual([ one, two ]);
      expect(base.resolvePaths('one two three')).toEqual([ one, two, three ]);
      expect(base.resolvePaths('one        two        three')).toEqual([ one, two, three ]);
      expect(base.resolvePaths('one two three four')).toEqual([ one, two, three, four ]);
      expect(base.resolvePaths('one        two        three        four')).toEqual([ one, two, three, four ]);
    });

    test('passed a string with extra commas', () => {
      const [ one, two, three, four ] = paths();
      const base = new Base();
      expect(base.resolvePaths('one,two,')).toEqual([ one, two ]);
      expect(base.resolvePaths('one,two,three,')).toEqual([ one, two, three ]);
      expect(base.resolvePaths('one,two,three,four')).toEqual([ one, two, three, four ]);
      expect(base.resolvePaths('one ,two ,')).toEqual([ one, two ]);
      expect(base.resolvePaths('one ,two ,three ,')).toEqual([ one, two, three ]);
      expect(base.resolvePaths('one ,two ,three ,four ,')).toEqual([ one, two, three, four ]);
      expect(base.resolvePaths('one  ,  two  ,  ')).toEqual([ one, two ]);
      expect(base.resolvePaths('one  ,  two  ,  three  ,  ')).toEqual([ one, two, three ]);
      expect(base.resolvePaths('one  ,  two  ,  three  ,  four  ,  ')).toEqual([ one, two, three, four ]);
    });

    test('passed a string with staring/trailing spaces', () => {
      const [ one, two, three ] = paths();
      const base = new Base();
      expect(base.resolvePaths('one two  ')).toEqual([ one, two ]);
      expect(base.resolvePaths('   one    ,    two      ')).toEqual([ one, two ]);
      expect(base.resolvePaths('  one two, three')).toEqual([ one, two, three ]);
      expect(base.resolvePaths('    one ,two        three')).toEqual([ one, two, three ]);
    });

    test('passed a array with normal paths', () => {
      const [ one, two, three, four ] = paths();
      const base = new Base();
      expect(base.resolvePaths([ 'one' ])).toEqual([ one ]);
      expect(base.resolvePaths([ 'one', 'two' ])).toEqual([ one, two ]);
      expect(base.resolvePaths([ 'one', 'two', 'three' ])).toEqual([ one, two, three ]);
      expect(base.resolvePaths([ 'one', 'two', 'three', 'four' ])).toEqual([ one, two, three, four ]);
    });

    test('passed a array with nested comma paths', () => {
      const [ one, two, three, four ] = paths();
      const base = new Base();
      expect(base.resolvePaths([ '   one,   ' ])).toEqual([ one ]);
      expect(base.resolvePaths([ 'one, two' ])).toEqual([ one, two ]);
      expect(base.resolvePaths([ 'one ,two', ', three   ' ])).toEqual([ one, two, three ]);
      expect(base.resolvePaths([ 'one', 'two    ,three', ',    four   ,' ])).toEqual([ one, two, three, four ]);
    });

    test('passed a array with nested spaced paths', () => {
      const [ one, two, three, four ] = paths();
      const base = new Base();
      expect(base.resolvePaths([ '   one   ' ])).toEqual([ one ]);
      expect(base.resolvePaths([ 'one two' ])).toEqual([ one, two ]);
      expect(base.resolvePaths([ 'one two', ' three   ' ])).toEqual([ one, two, three ]);
      expect(base.resolvePaths([ 'one', 'two    three', '    four   ' ])).toEqual([ one, two, three, four ]);
    });

    test('with different root', () => {
      const base = new Base();
      base.options.root = 'wooohoooo';
      const [ one, two, three, four ] = paths('wooohoooo');
      expect(base.resolvePaths('one, ')).toEqual([ one ]);
      expect(base.resolvePaths('one, two')).toEqual([ one, two ]);
      expect(base.resolvePaths('one, two, three')).toEqual([ one, two, three ]);
      expect(base.resolvePaths('one, two, three, four')).toEqual([ one, two, three, four ]);
      expect(base.resolvePaths([ 'one, ' ])).toEqual([ one ]);
      expect(base.resolvePaths([ 'one, two' ])).toEqual([ one, two ]);
      expect(base.resolvePaths([ 'one', 'two', 'three' ])).toEqual([ one, two, three ]);
      expect(base.resolvePaths([ 'one', 'two, three', 'four' ])).toEqual([ one, two, three, four ]);
    });
  });
});

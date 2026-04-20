import { describe, expect, test, beforeEach } from '@jest/globals';
import Logger from '../app/logger';
import to from '../app/to.js';
import { stripColor } from 'chalk';
import { PassThrough as PassThroughStream } from 'stream';
import _ from 'lodash';
import getStream from 'get-stream';
import formatSeconds from 'format-seconds';
import { startCapturing, stopCapturing } from './console';

const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

let logger;

describe('logger:', () => {
  beforeEach(() => {
    logger = new Logger();
  });

  test('functions', () => {
    expect(
      to.keys(Logger.prototype).sort()
    ).toEqual(
      [ 'constructor', 'log', 'spinner', 'stamp', 'time', 'timeEnd' ].sort()
    );
  });

  describe('options', () => {
    test('none', () => {
      expect(logger.options).toEqual({ log: true, verbose: false, spinners: true, timestamp: true });
    });

    test('log is false', () => {
      const newLogger = new Logger({ log: false });
      expect(newLogger.options).toEqual({ log: false, verbose: false, spinners: false, timestamp: true });
    });

    test('log is false and verbose is true', () => {
      const newLogger = new Logger({ log: false, verbose: true });
      expect(newLogger.options).toEqual({ log: true, verbose: true, spinners: true, timestamp: true });
    });
  });

  describe('log', () => {
    test('returns this', () => {
      startCapturing();
      const actual = logger.log();
      stopCapturing();
      expect(actual.constructor.name).toBe('Logger');
    });

    const log_types = [ ['warning'], ['success'], ['info'], ['verbose'], ['log'] ];

    test.each(log_types, (type) => {
      logger.options.verbose = true;
      startCapturing();
      logger.log(type, `${type} test`);
      const consoleOutput = stopCapturing();
      expect(consoleOutput.length).toBe(2);
      expect(consoleOutput[1].trim()).toBe(`${type} test`);
      if (![ 'warning', 'info' ].includes(type)) {
        type = '';
      }
      expect(stripColor(consoleOutput[0])).toMatch(new RegExp(`^\\[[0-9]+:[0-9]+:[0-9]+\\]\\s(?:.+)?\\s*${type}:?\\s*$`));
    });

    describe('throws error', () => {
      const regex = /^\[[0-9]+:[0-9]+:[0-9]+\]\s.+\serror:\s*$/;
      test('when string is passed as the type', () => {
        const tester = () => logger.log('error', 'woohoo');
        startCapturing();
        expect(tester).toThrow();
        const consoleOutput = stopCapturing();
        expect(consoleOutput.length).toBe(2);
        expect(consoleOutput[1].trim()).toBe('woohoo');
        expect(stripColor(consoleOutput[0])).toMatch(regex);
      });

      test('when error constructor is passed as the first argument', () => {
        const tester = () => logger.log(new Error('woohoo'));
        startCapturing();
        expect(tester).toThrow();
        const consoleOutput = stopCapturing();
        expect(consoleOutput.length).toBe(2);
        let [ message, ...err_lines ] = consoleOutput[1].split('\n');
        expect(message.trim()).toMatch(/\[?Error: woohoo\]?/);
        err_lines.forEach((line) => {
          line = line.trim();
          if (line) {
            expect(line.slice(0, 2)).toBe('at');
          }
        });
        expect(stripColor(consoleOutput[0])).toMatch(regex);
      });
    });

    test('time and timeEnd', async () => {
      const time = logger.log('time', 'woohoo');
      expect(time.constructor.name).toBe('Logger');
      await delay(200);
      const end = logger.log('timeEnd', 'woohoo');
      const woohoo = parseFloat(end.match(/\+([0-9.]+)/)[1]);
      expect(woohoo > 190).toBeTruthy();
    });
  });

  describe('time', () => {
    test('throws when no label is passed (time)', () => {
      const tester = () => logger.time();
      startCapturing();
      expect(tester).toThrow();
      const consoleOutput = stopCapturing();
      expect(stripColor(consoleOutput[0])).not.toBe(consoleOutput[0]);
      expect(stripColor(consoleOutput[0])).toMatch(/^\[[0-9]+:[0-9]+:[0-9]+\]\s.+\serror:\s*$/);
      expect(consoleOutput.length).toBe(2);
      expect(consoleOutput[1].split('\n')[0]).toBe('You must pass in a label for `Logger.prototype.time`');
    });

    test('throws when no label is passed (timeEnd)', () => {
      const tester = () => logger.timeEnd();
      startCapturing();
      expect(tester).toThrow();
      const consoleOutput = stopCapturing();
      expect(stripColor(consoleOutput[0])).not.toBe(consoleOutput[0]);
      expect(stripColor(consoleOutput[0])).toMatch(/^\[[0-9]+:[0-9]+:[0-9]+\]\s.+\serror:\s*$/);
      expect(consoleOutput.length).toBe(2);
      expect(consoleOutput[1].split('\n')[0]).toBe('You must pass in a label for `Logger.prototype.timeEnd`');
    });

    test('returns this', () => {
      const actual = logger.time('returns');
      expect(actual.constructor.name).toBe('Logger');
    });

    describe('formatting times', () => {
      let number = 0.0000025;
      const tests = _.times(9, () => {
        number *= 10;
        return number;
      });

      tests.forEach((time) => {
        const expected = formatSeconds(time);
        test(expected, async () => {
          logger.time(expected);
          await delay(time);
          const actual = logger.timeEnd(expected);
          expect(actual).toBeTruthy();
          expect(typeof actual).toBe('string');
          const [ number, unit ] = stripColor(actual).trim().match(/\+?([0-9.]+)\s*([µmsn]+)?/).slice(1);
          if (number !== '0') {
            expect(typeof unit).toBe('string');
            expect([ 'µs', 'ns', 'ms', 's', ].includes(unit)).toBeTruthy();
          }
          expect(typeof parseFloat(number)).toBe('number');
        });
      });
    });
  });

  describe('spinner', () => {
    function getPassThroughStream() {
      const stream = new PassThroughStream();
      stream.clearLine = _.noop;
      stream.cursorTo = _.noop;
      return stream;
    }

    test('returns a modified instance of Ora', () => {
      const actual = logger.spinner('instance');
      expect(actual.constructor.name).toBe('Ora');
      expect(actual.title).toBe('instance');
      expect(actual.text).toBe('instance');
      expect(typeof actual.originalStart).toBe('function');
      expect(typeof actual.originalStop).toBe('function');
      expect(actual.stopAndPersist.toString()).toMatch(/this\.originalStop\(\);/);
    });

    test('start/stop/stopAndPersist do nothing in TTY env', async () => {
      const actual = logger.spinner('woohoo');
      startCapturing();
      const start_result = actual.start();
      await delay(200);
      const stop_result = actual.stop();
      actual.start();
      const stop_and_persist_result = actual.stopAndPersist('✔');
      const consoleOutput = stopCapturing();
      expect(start_result.constructor.name).toBe('Ora');
      expect(stop_result.constructor.name).toBe('Ora');
      expect(stop_and_persist_result.constructor.name).toBe('Ora');
      expect(consoleOutput).toEqual([]);
    });

    test('start/stop custom stream', async () => {
      const stream = getPassThroughStream();
      const actual = logger.spinner({ stream, text: 'stop__', color: false, enabled: true });
      actual.start();
      await delay(200);
      actual.stop();
      stream.end();
      const output = await getStream(stream);
      output.trim().split('__').filter(Boolean).forEach((state) => {
        const [ frame, text ] = state.split(/\s+/);
        expect(actual.spinner.frames.includes(frame)).toBeTruthy();
        expect(text).toBe('stop');
      });
    });

    test('start/stop custom stream with verbose option', async () => {
      const stream = getPassThroughStream();
      logger.options.verbose = true;
      const actual = logger.spinner({ stream, text: 'stop__', color: false, enabled: true });
      actual.start();
      await delay(200);
      actual.stop();
      stream.end();
      const states = stripColor(await getStream(stream)).trim().split('__').filter(Boolean);
      const last_state = states.splice(-2, 2).join('');
      states.filter(Boolean).forEach((state) => {
        const [ frame, text ] = state.split(/\s+/);
        expect(actual.spinner.frames.includes(frame)).toBeTruthy();
        expect(text).toBe('stop');
      });
      {
        const [ check, text, time, unit ] = last_state.split(/\s+/);
        expect(check).toBe('√');
        expect(text).toBe('stop');
        expect(`${time} ${unit}`).toMatch(/^\+2[0-9]{2}\sms$/);
      }
    });

    test('fail custom stream', async () => {
      const stream = getPassThroughStream();
      const [ one, two, three ] = [ 'one', 'two', 'three' ].map((str) => logger.spinner({ stream, text: `${str}__`, color: false, enabled: true }));
      startCapturing();
      one.start();
      two.start();
      three.start();
      expect(one.id).toBeTruthy();
      expect(two.id).toBeTruthy();
      expect(three.id).toBeTruthy();
      const tester = () => three.fail('failed');
      expect(tester).toThrow();
      const consoleOutput = stopCapturing();
      expect(one.id).toBe(null);
      expect(two.id).toBe(null);
      expect(three.id).toBe(null);
      expect(stripColor(consoleOutput.join(''))).toMatch(/error: failed/);
      stream.end();
      const states = stripColor(await getStream(stream)).trim().split('__').filter(Boolean);
      const last_state = states.pop();
      states.forEach((state) => {
        const [ frame, text ] = state.split(/\s+/);
        expect(one.spinner.frames.includes(frame)).toBeTruthy();
        expect([ 'one', 'two', 'three' ].includes(text)).toBeTruthy();
      });

      {
        const [ check, text ] = last_state.split(/\s+/);
        expect(check).toBe('×');
        expect(text).toBe('three');
      }
    });

    test('spinner already exists so return it', () => {
      expect(logger.spinners).toEqual({});
      _.times(2, () => logger.spinner('exists'));
      expect(_.keys(logger.spinners)).toEqual([ 'exists' ]);
    });
  });
});

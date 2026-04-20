////
/// @name to
/// @description
/// Internal replacement for the to-js package, which depended on vulnerable packages
/// (is_js with ReDoS, marked with ReDoS, old babel-runtime).
/// Implements only the API surface used within this project.
////

import { camelCase, upperCase, startCase } from 'lodash';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

const toString = (arg) => Object.prototype.toString.call(arg);

function toType(arg) {
  return Buffer.isBuffer(arg) ? 'buffer' : toString(arg).slice(8, -1).toLowerCase();
}

// ---------------------------------------------------------------------------
// is — type-checking utilities
// ---------------------------------------------------------------------------

export const is = {
  string:      (v) => typeof v === 'string',
  number:      (v) => typeof v === 'number' && !isNaN(v),
  boolean:     (v) => typeof v === 'boolean',
  function:    (v) => typeof v === 'function',
  array:       (v) => Array.isArray(v),
  plainObject: (v) => toString(v) === '[object Object]',
  arguments:   (v) => toString(v) === '[object Arguments]',

  /** true when value is empty string, empty array, or object with no own props */
  empty(v) {
    if (is.plainObject(v)) {
      const num = Object.getOwnPropertyNames(v).length;
      return num === 0;
    }
    if (is.array(v)) {
      return v.length === 0;
    }
    return v === '';
  },

  /** is the value in obj (array, string, or plain object keys) */
  in(obj, value) {
    return (is.plainObject(obj) ? Object.keys(obj) : obj).indexOf(value) > -1;
  },
};

// ---------------------------------------------------------------------------
// to — conversion utilities
// ---------------------------------------------------------------------------

const to = {};

/**
 * Deep merge object b into a. Plain objects are merged recursively; all other
 * values are assigned by reference.
 */
to.extend = function extend(a, b) {
  if (!a || !b) return a;
  for (const k of Object.keys(b)) {
    if (Object.prototype.hasOwnProperty.call(b, k)) {
      if (is.plainObject(b[k])) {
        a[k] = is.plainObject(a[k]) ? to.extend(a[k], b[k]) : b[k];
      } else {
        a[k] = b[k];
      }
    }
  }
  return a;
};

/**
 * Returns the low-level type tag of a value, e.g. 'array', 'object',
 * 'string', 'number', 'boolean', 'null', 'undefined', 'function', 'buffer'.
 */
to.type = toType;

/**
 * Deeply flatten arrays. When called with an object, returns a flat
 * dot-notation key map (e.g. { a: { b: 1 } } → { 'a.b': 1 }).
 */
to.flatten = function flatten(...args) {
  const type = toType(args[0]);

  if (type === 'array' || type !== 'object') {
    // deep-flatten all arguments into a single flat array
    const flatArr = (arg) =>
      is.array(arg) ? [].concat(...arg.map(flatArr)) : arg;
    return flatArr(args.map(flatArr));
  }

  // object → dot-notation flattening
  function flattenObject(obj) {
    const result = {};
    for (const key of Object.keys(obj)) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          const sub = flattenObject(obj[key]);
          for (const x of Object.keys(sub)) {
            result[`${key}.${x}`] = sub[x];
          }
        } else {
          result[key] = obj[key];
        }
      }
    }
    return result;
  }

  return args.reduce((prev, next) => to.extend(prev, flattenObject(next)), {});
};

/**
 * Convert a value to an array.
 *   - Array  → returned as-is
 *   - String → split by glue (default '\n'); empty string → []
 *   - Plain object or number → wrapped in [ ]
 *   - Arguments object → Array.from(...)
 *   - Anything else → []
 */
to.array = function toArray(arg, glue = '\n') {
  if (is.array(arg)) return arg;
  if (is.arguments(arg)) return Array.from(arg);
  if (is.string(arg)) {
    const parts = arg.split(glue);
    return parts.length === 1 && parts[0] === '' ? [] : parts;
  }
  if (is.plainObject(arg) || is.number(arg)) return [arg];
  return [];
};

/**
 * Convert a value to a string.
 *   - String → returned as-is
 *   - Buffer → utf-8 decoded
 *   - Plain object → '[object Object]'
 *   - Array → joined with glue (default '\n')
 *   - Anything else → `${arg}`
 */
to.string = function toStr(arg, glue = '\n') {
  if (is.string(arg)) return arg;
  if (Buffer.isBuffer(arg)) return arg.toString('utf8');
  if (is.plainObject(arg)) return toString(arg);
  if (is.array(arg)) return arg.join(glue);
  return `${arg}`;
};

/**
 * Convert a value to a number.
 *   - Number → returned as-is
 *   - Array  → length
 *   - Plain object → number of keys
 *   - Anything else → ~~arg (bitwise double-NOT, truncates to int)
 */
to.number = function toNumber(arg) {
  if (is.number(arg)) return arg;
  if (is.array(arg)) return arg.length;
  if (is.plainObject(arg)) return Object.keys(arg).length;
  return ~~arg;
};

/**
 * Parse a JSON string (or Buffer) to an object.
 * If given an array of [key, value] pairs, converts it to an object.
 */
to.object = function toObject(arg) {
  if (is.array(arg)) {
    const result = {};
    for (const item of arg) {
      result[item[0]] = item[1];
    }
    return result;
  }
  if (Buffer.isBuffer(arg)) arg = arg.toString('utf8');
  return JSON.parse(arg);
};

/**
 * Deep clone a value. Functions are copied by reference (not deep-cloned).
 * Handles arrays, plain objects, Dates, and RegExps.
 */
to.clone = function toClone(arg) {
  if (arg === null || typeof arg !== 'object') return arg;
  if (Array.isArray(arg)) return arg.map(to.clone);
  if (arg instanceof Date) return new Date(arg.getTime());
  if (arg instanceof RegExp) return new RegExp(arg.source, arg.flags);
  const cloned = {};
  for (const key of Object.keys(arg)) {
    cloned[key] = to.clone(arg[key]);
  }
  return cloned;
};

/**
 * Serialize a value to a JSON string.
 * Returns false when value is not an object or string.
 */
to.json = function toJson(arg, spacing = 2) {
  return (is.plainObject(arg) || is.array(arg) || is.string(arg)) ? JSON.stringify(arg, null, spacing) : false;
};

/**
 * Return unique values from an array, preserving insertion order.
 */
to.unique = function toUnique(arg) {
  if (!is.array(arg)) return arg;
  return [...new Set(arg.map(String))].map((v) => {
    // restore original typed value where possible
    const idx = arg.findIndex((x) => String(x) === v);
    return arg[idx];
  });
};

/**
 * Convert a string to camelCase (delegates to lodash for compatibility).
 */
to.camelCase = camelCase;

/**
 * Convert a string to UPPER CASE (splits on camelCase/snake_case boundaries).
 * Delegates to lodash upperCase for change-case v2 compatibility.
 */
to.upperCase = upperCase;

/**
 * Convert a string to Title Case (splits on camelCase/snake_case boundaries).
 * Delegates to lodash startCase for change-case v2 compatibility.
 */
to.titleCase = startCase;

/**
 * Return an array of own enumerable key names for an object.
 * For non-objects returns the argument unchanged.
 */
to.keys = function toKeys(arg) {
  if (!is.plainObject(arg) && typeof arg !== 'symbol') return arg;
  return [
    ...Object.getOwnPropertySymbols(arg).map(String),
    ...Object.getOwnPropertyNames(arg),
  ];
};

/**
 * Map positional arguments to named properties based on a defaults object.
 * The first argument must be the defaults object; subsequent arguments are
 * the positional values to assign.
 *
 * @param {object} defaults - keys define the named properties
 * @param {...*} args - positional values
 * @returns {object}
 */
to.arguments = function toArguments(defaults = {}, ...args) {
  const result = {};
  const keys = Object.keys(defaults);

  args.forEach((arg, i) => {
    if (is.arguments(arg)) {
      // recurse with an arguments object
      arg = to.arguments(defaults, ...Array.from(arg));
    }
    if (is.plainObject(arg)) {
      const initial = defaults[keys[i]];
      const argKeys = Object.keys(arg);
      const initialKeys = is.plainObject(initial) ? Object.keys(initial) : [];
      if (is.plainObject(initial) && argKeys.some((k) => initialKeys.includes(k))) {
        result[keys[i]] = to.extend({ ...initial }, arg);
      } else {
        to.extend(result, arg);
      }
    } else {
      result[keys[i] !== undefined ? keys[i] : i] = arg;
    }
  });

  return result;
};

/**
 * Normalize a multi-line string: remove leading/trailing blank lines and strip
 * the minimum common indentation from all non-empty lines.
 * @param {string|string[]} content
 * @returns {string}
 */
to.normalize = function normalize(content) {
  if (is.array(content)) content = content.join('\n');
  const lines = to.string(content).split('\n');

  // Remove leading blank lines
  while (lines.length && !lines[0].trim()) lines.shift();
  // Remove trailing blank lines
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  // Find minimum indentation across non-empty lines
  const indent = lines
    .filter((line) => line.trim())
    .reduce((min, line) => {
      const spaces = (line.match(/^(\s*)/)[1] || '').length;
      return Math.min(min, spaces);
    }, Infinity);

  return lines
    .map((line) => line.slice(Math.min(Number.isFinite(indent) ? indent : 0, line.length)))
    .join('\n');
};

/**
 * Return a random number between min and max (inclusive), or a random element
 * from an array.
 * @param {number|any[]} min - lower bound or source array
 * @param {number} [max] - upper bound (when min is a number)
 * @returns {number|*}
 */
to.random = function random(min = 0, max = 100) {
  if (is.array(min)) {
    const arr = min;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  if (min === max) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Iterate over each entry of an object, calling callback({ key, value, index }).
 * Similar to to.objectEntries but uses a callback instead of a for…of iterator.
 * @param {object} obj
 * @param {function} callback - receives { key, value, index }
 */
to.each = function each(obj, callback) {
  const keys = Object.keys(obj);
  keys.forEach((key, index) => {
    callback({ key, value: obj[key], index });
  });
};

/**
 * Return an iterator that yields [key, value] pairs for arrays or objects.
 * Mirrors the to-js entries() API for for…of usage.
 * @param {any[]|object} obj
 * @returns {Iterable}
 */
to.entries = function entries(obj) {
  if (is.array(obj)) return obj.entries();
  return Object.entries(obj);
};

export default to;

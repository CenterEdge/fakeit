/**
 * Console mocking utility for capturing console output in tests
 * Handles both console.log and process.stdout.write
 */

let capturedOutput = [];
let originalLog = null;
let originalWrite = null;

/**
 * Start capturing console output
 */
export function startCapturing() {
  capturedOutput = [];
  originalLog = console.log;
  originalWrite = process.stdout.write;
  
  console.log = (...args) => {
    capturedOutput.push(args.join(' '));
  };
  
  process.stdout.write = (...args) => {
    capturedOutput.push(args[0]);
    return true;
  };
}

/**
 * Stop capturing console output and restore original methods
 * @returns {Array} The captured output array
 */
export function stopCapturing() {
  const output = capturedOutput;
  
  if (originalLog !== null) {
    console.log = originalLog;
  }
  if (originalWrite !== null) {
    process.stdout.write = originalWrite;
  }
  
  originalLog = null;
  originalWrite = null;
  capturedOutput = [];
  
  return output;
}

/**
 * Get the current captured output without stopping capture
 * @returns {Array} The captured output array
 */
export function getCapturedOutput() {
  return [...capturedOutput];
}

/**
 * Convenience function to capture output for a test block
 * @param {Function} callback - The test function to run while capturing
 * @returns {Promise<Array>} The captured output after the callback completes
 */
export async function captureOutput(callback) {
  let result;

  startCapturing();
  try {
    await callback();
  } finally {
    result = stopCapturing();
  }
  
  return result;
}

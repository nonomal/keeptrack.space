// eslint-disable-next-line @typescript-eslint/no-var-requires
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Anchored to the repo root (this file lives in build/utils/), so the script
// works from any cwd. Shared test utilities live in test/; plugin tests belong
// in src/plugins/<name>/__tests__/ and are not created by this tool.
const TEST_DIR = join(__dirname, '..', '..', 'test');

/**
 * Resolve the destination test file and ensure it stays inside TEST_DIR. The
 * file name comes from a CLI argument / stdin, so a value containing `..` or an
 * absolute path could otherwise escape the project directory. Throws on escape.
 */
const safeTestPath = (name: string): string => {
  const baseResolved = resolve(TEST_DIR);
  const target = resolve(baseResolved, `${name}.test.ts`);

  if (!target.startsWith(baseResolved + sep)) {
    throw new Error(`Refusing to write test file outside ${baseResolved}: ${name}`);
  }

  return target;
};

// Get first argument from command line
const fileName = process.argv[2];

if (!fileName) {
  console.log('Enter file name: ');

  process.stdin.on('data', (input) => {
    const fileName: string = input.toString().trim();

    // Create an empty .test.ts file
    writeFileSync(safeTestPath(fileName), '');

    // Exit process
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  });
} else {

  // Create an empty .test.ts file
  writeFileSync(safeTestPath(fileName), '');
}

/**
 * Run every wire test in sequence and exit non-zero if any fail.
 *   node tests/runAll.js
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = [
  "test-voice-login.js",
  "test-ai-chat.js",
  "test-goie.js",
  "test-multiverse.js",
  "test-cinematic.js",
];

let failures = 0;
for (const t of tests) {
  console.log(`\n\x1b[1m── ${t} ──\x1b[0m`);
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, t)], { stdio: "inherit" });
    child.on("exit", resolve);
  });
  if (code !== 0) failures++;
}
console.log(failures === 0 ? "\n\x1b[32mAll tests passed\x1b[0m" : `\n\x1b[31m${failures} test file(s) failed\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);

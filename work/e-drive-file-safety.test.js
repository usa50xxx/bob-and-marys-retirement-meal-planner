const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  replaceOpenFile,
  writeExclusiveBackup,
} = require("./e-drive-click-test.js");

async function readOpenFile(fileHandle, encoding) {
  const details = await fileHandle.stat();
  const contents = Buffer.alloc(details.size);
  await fileHandle.read(contents, 0, contents.length, 0);
  return encoding ? contents.toString(encoding) : contents;
}

async function run() {
  const harnessSource = await fs.readFile(
    path.join(__dirname, "e-drive-click-test.js"),
    "utf8",
  );
  assert.doesNotMatch(harnessSource, /existsSync\(dataPath\)/);
  assert.match(harnessSource, /fsp\.open\(dataPath,\s*"r\+"\)/);
  assert.match(harnessSource, /fsp\.open\(targetPath,\s*"wx"/);

  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "bob-mary-e-drive-safety-"),
  );
  const dataPath = path.join(directory, "planner-data.json");
  const backupPath = path.join(directory, "planner-data-backup.json");
  const original = Buffer.from('{"recipes":["original"]}\n', "utf8");
  const replacement = '{"recipes":["test"]}\n';

  await fs.writeFile(dataPath, original, { flag: "wx", mode: 0o600 });
  const dataHandle = await fs.open(dataPath, "r+");

  try {
    await writeExclusiveBackup(backupPath, original);
    await assert.rejects(
      writeExclusiveBackup(backupPath, Buffer.from("overwrite")),
      (error) => error.code === "EEXIST",
    );
    assert.deepEqual(await fs.readFile(backupPath), original);

    await replaceOpenFile(dataHandle, replacement);
    assert.equal(await readOpenFile(dataHandle, "utf8"), replacement);

    await replaceOpenFile(dataHandle, original);
    assert.deepEqual(await readOpenFile(dataHandle), original);
  } finally {
    await dataHandle.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
}

run()
  .then(() => console.log("E-drive data safety tests passed."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

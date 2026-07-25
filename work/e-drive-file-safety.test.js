const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  replaceOpenFile,
  writeExclusiveBackup,
} = require("./e-drive-click-test.js");

async function run() {
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
    assert.equal(await fs.readFile(dataPath, "utf8"), replacement);

    await replaceOpenFile(dataHandle, original);
    assert.deepEqual(await fs.readFile(dataPath), original);
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

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { stageReleaseAssets } from "./release-assets.mjs";

export async function buildPrivacySite({
  projectRoot = process.cwd(),
  destination = path.join("work", "privacy-site-built"),
} = {}) {
  const source = path.join(projectRoot, "privacy-site");
  const policy = path.join(projectRoot, "PRIVACY.md");
  const output = path.resolve(projectRoot, destination);

  await fs.rm(output, { recursive: true, force: true });
  await fs.cp(source, output, { recursive: true });
  const markdown = await fs.readFile(policy, "utf8");
  if (!/^# Privacy policy\s*$/m.test(markdown)) {
    throw new Error("PRIVACY.md must contain the Privacy policy heading.");
  }
  await fs.writeFile(
    path.join(output, "index.md"),
    `---\nlayout: default\ntitle: Privacy policy\npermalink: /\n---\n\n${markdown}`,
    "utf8",
  );
  await stageReleaseAssets({
    projectRoot,
    destination: path.join(output, "app"),
  });
  return output;
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const output = await buildPrivacySite();
  console.log(`Privacy site prepared at ${output}`);
}

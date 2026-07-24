import path from "node:path";
import { stageReleaseAssets } from "./release-assets.mjs";

const projectRoot = process.cwd();
const destination = path.join(projectRoot, "work", "release-web", "meal-planner");
const result = await stageReleaseAssets({ projectRoot, destination });

console.log(`Staged ${result.fileCount} public files in ${result.destination}`);

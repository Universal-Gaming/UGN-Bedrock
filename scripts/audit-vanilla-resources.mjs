import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

/*
 * Verifies that the Minecraft data and texture atlases supplied by the
 * upstream web-client's installed dependencies are present before release.
 *
 * This DOES NOT copy Mojang jar contents or redistribute separate game packs.
 * The original upstream build already embeds its mc-assets block/item atlases.
 *
 * Use together with useVersionsTextures="" so the atlas is selected for the
 * actual connected protocol version, including Java 1.19.4.
 */
const root = path.resolve(process.argv[2] || "../upstream");
const requireUpstream = createRequire(path.join(root, "package.json"));
const { default: versions } = await import(pathToFileURL(path.join(root, "src/supportedVersions.mjs")).href);
const MinecraftData = requireUpstream("minecraft-data");
const blocksAtlases = requireUpstream("mc-assets/dist/blocksAtlases.json");
const itemsAtlases = requireUpstream("mc-assets/dist/itemsAtlases.json");
const blockStatesModels = requireUpstream("mc-assets/dist/blockStatesModels.json");
const issues = [];
const report = {
  client: "minecraft-web-client",
  selectedTextureVersion: "world-version",
  textureSelectionSettings: { useVersionsTextures: "", disableAssets: false },
  verifiedAtBuild: true,
  versions: [],
  blockAtlasKeys: Object.keys(blocksAtlases || {}),
  itemAtlasKeys: Object.keys(itemsAtlases || {}),
  blockModelsAvailable: !!blockStatesModels?.models?.latest && !!blockStatesModels?.blockstates?.latest
};

if (!report.blockModelsAvailable) issues.push("Minecraft blockstates/model data were not packaged.");
if (!report.blockAtlasKeys.length) issues.push("Block texture atlas metadata missing.");
if (!report.itemAtlasKeys.length) issues.push("Item texture atlas metadata missing.");
if (!Array.isArray(versions) || versions.length === 0) issues.push("Supported Java version list is empty.");
if (!versions.includes("1.19.4")) issues.push("Java 1.19.4 is missing from supported versions.");

for (const version of versions) {
  try {
    const registry = MinecraftData(version);
    const blocks = registry?.blocksByName;
    const items = registry?.itemsByName;
    const stone = blocks?.stone;
    const dirt = blocks?.dirt;
    const actual = registry?.version?.minecraftVersion;
    const good = Boolean(actual && stone && dirt && items);
    if (!good) issues.push("Missing vanilla block/item data for Java " + version);
    report.versions.push({
      version,
      dataReady: good,
      stoneState: stone?.defaultState ?? null,
      blockDefinitions: blocks ? Object.keys(blocks).length : 0,
      itemDefinitions: items ? Object.keys(items).length : 0
    });
  } catch (err) {
    issues.push("Vanilla data could not initialize for " + version + ": " + String(err));
    report.versions.push({ version, dataReady: false });
  }
}
const oneNineteen = report.versions.find(v => v.version === "1.19.4");
if (!oneNineteen?.dataReady) issues.push("Java 1.19.4 registry failed validation.");

const out = path.join(root, "dist", "ugn-vanilla-assets.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log("[UGN vanilla asset audit] supported versions:", versions.length);
console.log("[UGN vanilla asset audit] 1.19.4:", oneNineteen);
console.log("[UGN vanilla asset audit] block atlas names:", report.blockAtlasKeys.slice(0, 24).join(", "));
console.log("[UGN vanilla asset audit] item atlas names:", report.itemAtlasKeys.slice(0, 24).join(", "));
console.log("[UGN vanilla asset audit] source block models:", report.blockModelsAvailable);
if (issues.length) {
  console.error("[UGN vanilla asset audit] FAILURE:\n - " + issues.join("\n - "));
  process.exitCode = 1;
} else {
  console.log("[UGN vanilla asset audit] all supported versions have vanilla block/item registry data.");
}

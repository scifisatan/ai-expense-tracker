import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../src/domain", import.meta.url);
const violations = [];

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    if (!entry.isFile() || (!fullPath.endsWith(".ts") && !fullPath.endsWith(".tsx"))) continue;

    const content = await readFile(fullPath, "utf8");
    const imports = [...content.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);

    for (const imp of imports) {
      const isAdapterImport =
        imp.includes("/adapters/") || imp.includes("../adapters") || imp.includes("../../adapters");
      const isApplicationImport =
        imp.includes("/application/") ||
        imp.includes("../application") ||
        imp.includes("../../application");
      const isBootstrapImport =
        imp.includes("/bootstrap/") ||
        imp.includes("../bootstrap") ||
        imp.includes("../../bootstrap");

      if (isAdapterImport || isApplicationImport || isBootstrapImport) {
        violations.push(`${fullPath}: ${imp}`);
      }
    }
  }
};

await walk(root.pathname);

if (violations.length > 0) {
  console.error(
    "[architecture-check] Domain modules must not import adapters/application/bootstrap:",
  );
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}

console.log("[architecture-check] OK");

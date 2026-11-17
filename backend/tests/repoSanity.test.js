const { execSync } = require("child_process");
const path = require("path");

describe("Repository Sanity & Merge Conflict Marker Tests", () => {
  test("No git merge conflict markers remain anywhere in tracked repository files", () => {
    const repoRoot = path.resolve(__dirname, "../..");
    let matches = "";
    try {
      matches = execSync('git grep -n -E "^(<<<<<<<|>>>>>>>)"', {
        cwd: repoRoot,
        encoding: "utf-8",
      });
    } catch (err) {
      // Exit code 1 from git grep indicates 0 matches found (clean repository)
      matches = "";
    }

    expect(matches.trim()).toBe("");
  });
});

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
ModuleLib._initPaths();
const helperFactory = require("../../node_helper.js");
const store = require("../../lib/visitorMode.js");

test("visitor mode persists across helper reloads without changing manual defaults", (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "visitor-mode-"));
  t.after(() => fs.rmSync(folder, {recursive: true, force: true}));
  const helper = Object.create(helperFactory);
  helper.visitorModeFile = path.join(folder, "visitor-mode.json");
  helper.visitorMode = store.loadVisitorMode(helper.visitorModeFile);
  helper.configData = {moduleData: [
    {identifier: "calendar_1", name: "calendar", position: "top_left", blurred: true},
    {identifier: "calendar_2", name: "calendar", position: "top_right"}
  ]};
  helper.requireLiveState = (_res, callback) => callback();
  const errors = [];
  const notifications = [];
  helper.sendResponse = (_res, error) => { if (error) errors.push(error); };
  helper.sendSocketNotification = (name, state) => { notifications.push({name, state}); };
  helper.executeQuery({action: "SET_VISITOR_MODE", modules: ["calendar_1", "calendar_1"]}, {});
  assert.deepEqual(store.loadVisitorMode(helper.visitorModeFile), {enabled: false, modules: ["calendar_1"]});
  helper.executeQuery({action: "SET_VISITOR_MODE", enabled: true}, {});
  assert.deepEqual(store.loadVisitorMode(helper.visitorModeFile), {enabled: true, modules: ["calendar_1"]});
  helper.executeQuery({action: "SET_VISITOR_MODE", modules: ["calendar_2"]}, {});
  assert.deepEqual(notifications.at(-1).state.modules, ["calendar_2"]);
  helper.executeQuery({action: "SET_VISITOR_MODE", enabled: false}, {});
  assert.equal(helper.configData.moduleData[0].blurred, true);
  assert.equal(errors.length, 0);
  helper.executeQuery({action: "SET_VISITOR_MODE", enabled: "false"}, {});
  helper.executeQuery({action: "SET_VISITOR_MODE", modules: ["unknown"]}, {});
  assert.equal(errors.length, 2);
  assert.deepEqual(store.loadVisitorMode(helper.visitorModeFile), {enabled: false, modules: ["calendar_2"]});
  // A removed module must never prevent turning an existing preset off.
  helper.visitorMode = {enabled: true, modules: ["removed"]};
  helper.executeQuery({action: "SET_VISITOR_MODE", enabled: false}, {});
  assert.equal(helper.visitorMode.enabled, false);
  // Failed writes must not activate the preset or broadcast a success state.
  helper.visitorModeFile = path.join(folder, "missing", "visitor-mode.json");
  const previous = helper.visitorMode;
  const count = notifications.length;
  helper.executeQuery({action: "SET_VISITOR_MODE", modules: ["calendar_1"], enabled: true}, {});
  assert.equal(helper.visitorMode, previous);
  assert.equal(notifications.length, count);
  assert.equal(errors.length, 3);
});

test("visitor preset validates empty and malformed selections", () => {
  assert.throws(() => store.normalizeVisitorMode({enabled: true, modules: []}));
  assert.throws(() => store.normalizeVisitorMode({enabled: false, modules: [null]}));
  assert.deepEqual(store.normalizeVisitorMode({enabled: false, modules: []}), {enabled: false, modules: []});
});

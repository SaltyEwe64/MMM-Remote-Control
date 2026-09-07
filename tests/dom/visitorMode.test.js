const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {Window} = require("happy-dom");

test("visitor blur is separate from manual blur and visibility", () => {
  const window = new Window();
  let definition;
  const modules = ["calendar_1", "calendar_2"].map((identifier) => ({identifier, name: "calendar"}));
  window.Module = {register: (_name, value) => { definition = value; }};
  window.MM = {getModules: () => modules};
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../MMM-Remote-Control.js"), "utf8"), vm.createContext(window));
  definition.sendCurrentData = () => {};
  window.document.body.innerHTML = "<div id=\"calendar_1\" class=\"remote-control-blurred\"></div><div id=\"calendar_2\"></div>";
  const first = window.document.getElementById("calendar_1");
  const second = window.document.getElementById("calendar_2");
  definition.socketNotificationReceived("VISITOR_MODE_STATE", {enabled: true, modules: ["calendar_1"]});
  assert.ok(first.classList.contains("remote-control-visitor-blurred"));
  assert.equal(second.classList.contains("remote-control-visitor-blurred"), false);
  first.innerHTML = "Updated content";
  assert.ok(first.classList.contains("remote-control-visitor-blurred"));
  definition.applyVisitorMode({enabled: true, modules: ["calendar_2"]});
  assert.equal(first.classList.contains("remote-control-visitor-blurred"), false);
  assert.ok(second.classList.contains("remote-control-visitor-blurred"));
  definition.applyVisitorMode({enabled: false, modules: ["calendar_2"]});
  assert.equal(second.classList.contains("remote-control-visitor-blurred"), false);
  assert.ok(first.classList.contains("remote-control-blurred"));
  window.close();
});

test("visitor controls save exact instances and update from shared state", async () => {
  const {setupRemote} = await import("./setup.mjs");
  const remote = await setupRemote();
  await import("../../remote/remote-render.mjs");
  remote.translations = {VISITOR_MODE_ON: "Visitor mode: On", VISITOR_MODE_OFF: "Visitor mode: Off"};
  document.body.innerHTML = remote.renderMainMenu() + remote.renderVisitorModePanel();
  const actions = [];
  remote.action = (action, payload) => { actions.push({action, ...payload}); };
  const state = {enabled: false,
    modules: [],
    availableModules: [
      {identifier: "calendar_1", name: "calendar", header: "Family"},
      {identifier: "calendar_2", name: "calendar", header: "Kids"}
    ]};
  remote.updateVisitorModeControls(state);
  const toggle = document.querySelector(".visitor-mode-toggle");
  assert.equal(toggle.disabled, true);
  document.querySelectorAll("input")[1].checked = true;
  document.querySelector(".visitor-mode-save").click();
  assert.deepEqual(actions[0], {action: "SET_VISITOR_MODE", modules: ["calendar_2"], enabled: false});
  remote.socketNotificationReceived("VISITOR_MODE_STATE", {...state, modules: ["calendar_2"]});
  toggle.click();
  assert.deepEqual(actions[1], {action: "SET_VISITOR_MODE", enabled: true});
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
  remote.socketNotificationReceived("VISITOR_MODE_STATE", {...state, enabled: true, modules: ["calendar_2"]});
  assert.equal(toggle.textContent, "Visitor mode: On");
  toggle.click();
  assert.deepEqual(actions[2], {action: "SET_VISITOR_MODE", enabled: false});
  document.querySelectorAll("input")[1].checked = false;
  document.querySelector(".visitor-mode-save").click();
  assert.deepEqual(actions[3], {action: "SET_VISITOR_MODE", modules: [], enabled: false});
});

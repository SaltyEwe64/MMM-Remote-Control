const {test, describe, before, after} = require("node:test");
const assert = require("node:assert/strict");
const {Window} = require("happy-dom");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

describe("MMM-Remote-Control.js module", () => {
  let window, Module;

  before(() => {
    window = new Window({
      url: "http://localhost:8080",
      settings: {
        disableJavaScriptFileLoading: true,
        disableJavaScriptEvaluation: false,
        disableCSSFileLoading: true
      }
    });

    window.Module = {
      register: function (moduleName, moduleDefinition) {
        Module = moduleDefinition;
      }
    };

    window.MM = {
      getModules: () => ({
        enumerate: () => {}
      })
    };

    window.Log = {
      info: () => {},
      log: () => {},
      error: () => {},
      warn: () => {}
    };

    window.location = {hash: ""};
    window.globalThis = window;

    const modulePath = path.join(__dirname, "../../MMM-Remote-Control.js");
    const moduleCode = fs.readFileSync(modulePath, "utf8");
    const context = vm.createContext(window);
    vm.runInContext(moduleCode, context);
  });

  after(() => {
    window.close();
  });

  test("module is registered with Module.register", () => {
    assert.ok(Module, "Module should be defined");
    assert.ok(Module.handleDefaultSettings, "handleDefaultSettings should exist");
  });

  test("handleDefaultSettings handles missing lockStrings gracefully", () => {
    const payload = {
      settingsVersion: 1,
      moduleData: [
        {identifier: "module_1", name: "clock"},
        {identifier: "module_2", name: "calendar", lockStrings: ["lock1"]},
        {identifier: "module_3", name: "weather", lockStrings: undefined}
      ],
      brightness: 100,
      temp: 327,
      zoom: 100,
      backgroundColor: "",
      fontColor: ""
    };

    assert.doesNotThrow(() => {
      Module.handleDefaultSettings.call({
        identifier: "MMM-Remote-Control",
        settingsVersion: 1,
        setBrightness: () => {},
        setTemp: () => {},
        setZoom: () => {},
        setBackgroundColor: () => {},
        setFontColor: () => {}
      }, payload);
    });
  });

  test("handleDefaultSettings handles non-array lockStrings", () => {
    const payload = {
      settingsVersion: 1,
      moduleData: [{identifier: "module_1", name: "clock", lockStrings: "not-an-array"}],
      brightness: 100,
      temp: 327,
      zoom: 100,
      backgroundColor: "",
      fontColor: ""
    };

    assert.doesNotThrow(() => {
      Module.handleDefaultSettings.call({
        identifier: "MMM-Remote-Control",
        settingsVersion: 1,
        setBrightness: () => {},
        setTemp: () => {},
        setZoom: () => {},
        setBackgroundColor: () => {},
        setFontColor: () => {}
      }, payload);
    });
  });
});


test("blur targets instances, survives content updates, and preserves visibility", () => {
  const window = new Window();
  let definition;
  const modules = ["calendar_1", "calendar_2", "missing"].map((identifier) => ({
    identifier,
    name: "calendar",
    data: {identifier},
    hidden: true,
    lockStrings: ["other-module"],
    hide: () => assert.fail("blur must not hide"),
    show: () => assert.fail("blur must not show")
  }));
  modules.enumerate = (callback) => { for (const module of modules) callback(module); };
  window.Module = {register: (_name, value) => { definition = value; }};
  window.MM = {getModules: () => modules};
  window.Log = {debug: () => {}};
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../MMM-Remote-Control.js"), "utf8"), vm.createContext(window));
  window.document.body.innerHTML = "<div id=\"calendar_1\"><h2>Private</h2></div><div id=\"calendar_2\"></div>";
  let status;
  definition.sendSocketNotification = (_notification, payload) => { status = payload; };
  definition.socketNotificationReceived("BLUR", {module: "calendar_1"});
  const first = window.document.getElementById("calendar_1");
  const second = window.document.getElementById("calendar_2");
  assert.ok(first.classList.contains("remote-control-blurred"));
  assert.equal(second.classList.contains("remote-control-blurred"), false);
  first.innerHTML = "Updated calendar";
  assert.ok(first.classList.contains("remote-control-blurred"));
  assert.equal(status.moduleData[0].blurred, true);
  assert.equal(status.moduleData[2].blurred, false);
  definition.socketNotificationReceived("BLUR", {module: "calendar_1"});
  assert.ok(first.classList.contains("remote-control-blurred"));
  definition.socketNotificationReceived("TOGGLE_BLUR", {module: ["calendar_1", "calendar_2"]});
  assert.equal(first.classList.contains("remote-control-blurred"), false);
  assert.ok(second.classList.contains("remote-control-blurred"));
  definition.socketNotificationReceived("BLUR", {module: "calendar"});
  assert.ok(first.classList.contains("remote-control-blurred"));
  definition.socketNotificationReceived("UNBLUR", {module: "all"});
  assert.equal(second.classList.contains("remote-control-blurred"), false);
  definition.handleModuleBlur("BLUR");
  definition.handleModuleBlur("BLUR", {module: "unknown"});
  for (const module of modules) {
    assert.equal(module.hidden, true);
    assert.deepEqual(module.lockStrings, ["other-module"]);
  }
  for (const method of ["setBrightness", "setTemp", "setZoom", "setBackgroundColor", "setFontColor"]) definition[method] = () => {};
  definition.handleDefaultSettings({settingsVersion: 2, moduleData: [{identifier: "calendar_1", blurred: true}]});
  assert.ok(first.classList.contains("remote-control-blurred"));
  definition.handleDefaultSettings({settingsVersion: 2, moduleData: [{identifier: "calendar_1"}]});
  assert.equal(first.classList.contains("remote-control-blurred"), false);
  window.close();
});

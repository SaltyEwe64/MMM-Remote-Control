const fs = require("node:fs");

/**
 * Validate a visitor preset before storing or applying it.
 * @param {object} state - Candidate preset
 * @returns {object} Normalized preset
 */
function normalizeVisitorMode (state) {
  if (!state || typeof state.enabled !== "boolean" || !Array.isArray(state.modules) || state.modules.some((id) => typeof id !== "string" || !id)) {
    throw new Error("Invalid visitor mode settings");
  }
  const modules = [...new Set(state.modules)];
  if (state.enabled && modules.length === 0) throw new Error("Choose at least one module for visitor mode");
  return {enabled: state.enabled, modules};
}

/**
 * Read the shared preset; a new installation starts with visitor mode off.
 * @param {string} filename - Preset file
 * @returns {object} Saved preset
 */
function loadVisitorMode (filename) {
  try {
    return normalizeVisitorMode(JSON.parse(fs.readFileSync(filename, "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return {enabled: false, modules: []};
    throw error;
  }
}

/**
 * Replace the preset atomically so incomplete writes cannot erase it.
 * @param {string} filename - Preset file
 * @param {object} state - Validated preset
 */
function saveVisitorMode (filename, state) {
  const normalized = normalizeVisitorMode(state);
  fs.writeFileSync(filename + ".tmp", JSON.stringify(normalized), "utf8");
  fs.renameSync(filename + ".tmp", filename);
}

module.exports = {normalizeVisitorMode, loadVisitorMode, saveVisitorMode};

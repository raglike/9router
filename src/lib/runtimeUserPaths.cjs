const path = require("path");

function readEnv(name) {
  const value = process.env?.[name];
  return typeof value === "string" && value.trim() ? value : "";
}

function getHomeDir() {
  return readEnv("HOME") || readEnv("USERPROFILE");
}

function joinHome(...segments) {
  const homeDir = getHomeDir();
  return homeDir ? path.join(homeDir, ...segments) : path.join(...segments);
}

function joinAppData(...segments) {
  const appDataDir = readEnv("APPDATA");
  return appDataDir
    ? path.join(appDataDir, ...segments)
    : joinHome("AppData", "Roaming", ...segments);
}

function joinLocalAppData(...segments) {
  const localAppDataDir = readEnv("LOCALAPPDATA");
  return localAppDataDir
    ? path.join(localAppDataDir, ...segments)
    : joinHome("AppData", "Local", ...segments);
}

function joinConfigHome(...segments) {
  const configHomeDir = readEnv("XDG_CONFIG_HOME");
  return configHomeDir
    ? path.join(configHomeDir, ...segments)
    : joinHome(".config", ...segments);
}

function joinDataHome(...segments) {
  const dataHomeDir = readEnv("XDG_DATA_HOME");
  return dataHomeDir
    ? path.join(dataHomeDir, ...segments)
    : joinHome(".local", "share", ...segments);
}

function getProgramFilesDir() {
  return readEnv("ProgramFiles") || "C:\\Program Files";
}

function getMacApplicationSupportDir() {
  return joinHome("Library", "Application Support");
}

module.exports = {
  getHomeDir,
  joinHome,
  joinAppData,
  joinLocalAppData,
  joinConfigHome,
  joinDataHome,
  getProgramFilesDir,
  getMacApplicationSupportDir,
};

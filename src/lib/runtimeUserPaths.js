import path from "path";

function readEnv(name) {
  const value = process.env?.[name];
  return typeof value === "string" && value.trim() ? value : "";
}

export function getHomeDir() {
  return readEnv("HOME") || readEnv("USERPROFILE");
}

export function joinHome(...segments) {
  const homeDir = getHomeDir();
  return homeDir ? path.join(homeDir, ...segments) : path.join(...segments);
}

export function joinAppData(...segments) {
  const appDataDir = readEnv("APPDATA");
  return appDataDir
    ? path.join(appDataDir, ...segments)
    : joinHome("AppData", "Roaming", ...segments);
}

export function joinLocalAppData(...segments) {
  const localAppDataDir = readEnv("LOCALAPPDATA");
  return localAppDataDir
    ? path.join(localAppDataDir, ...segments)
    : joinHome("AppData", "Local", ...segments);
}

export function joinConfigHome(...segments) {
  const configHomeDir = readEnv("XDG_CONFIG_HOME");
  return configHomeDir
    ? path.join(configHomeDir, ...segments)
    : joinHome(".config", ...segments);
}

export function joinDataHome(...segments) {
  const dataHomeDir = readEnv("XDG_DATA_HOME");
  return dataHomeDir
    ? path.join(dataHomeDir, ...segments)
    : joinHome(".local", "share", ...segments);
}

export function getProgramFilesDir() {
  return readEnv("ProgramFiles") || "C:\\Program Files";
}

export function getMacApplicationSupportDir() {
  return joinHome("Library", "Application Support");
}

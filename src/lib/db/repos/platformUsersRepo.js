import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

export const PLATFORM_ROLES = {
  ROOT: "root",
  ADMIN: "admin",
  USER: "user",
};

const ROLE_LEVEL = {
  [PLATFORM_ROLES.USER]: 1,
  [PLATFORM_ROLES.ADMIN]: 2,
  [PLATFORM_ROLES.ROOT]: 3,
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function cleanUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email || "",
    displayName: row.displayName || row.username,
    role: row.role || PLATFORM_ROLES.USER,
    status: row.status || "active",
    subscriberId: row.subscriberId || null,
    data: parseJson(row.data, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function hasRole(user, minRole = PLATFORM_ROLES.USER) {
  const userLevel = ROLE_LEVEL[user?.role] || 0;
  const minLevel = ROLE_LEVEL[minRole] || ROLE_LEVEL[PLATFORM_ROLES.USER];
  return userLevel >= minLevel;
}

export async function countPlatformUsers() {
  const db = await getAdapter();
  const row = db.get(`SELECT COUNT(*) AS count FROM platformUsers`);
  return row?.count || 0;
}

export async function getPlatformUserById(id, { includePassword = false } = {}) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM platformUsers WHERE id = ?`, [id]);
  if (!row) return null;
  if (includePassword) return { ...cleanUser(row), passwordHash: row.passwordHash };
  return cleanUser(row);
}

export async function getPlatformUserByUsername(username, { includePassword = false } = {}) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM platformUsers WHERE username = ?`, [normalizeUsername(username)]);
  if (!row) return null;
  if (includePassword) return { ...cleanUser(row), passwordHash: row.passwordHash };
  return cleanUser(row);
}

export async function getPlatformUsers() {
  const db = await getAdapter();
  return db.all(`SELECT * FROM platformUsers ORDER BY createdAt DESC`).map(cleanUser);
}

export async function createPlatformUser(input) {
  const username = normalizeUsername(input.username);
  const password = String(input.password || "");
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    throw new Error("用户名需为 3-32 位小写字母、数字、下划线、点或短横线");
  }
  if (password.length < 8 || password.length > 72) {
    throw new Error("密码长度需为 8-72 位");
  }

  const db = await getAdapter();
  const existing = db.get(
    `SELECT id FROM platformUsers WHERE username = ? OR (email IS NOT NULL AND email != '' AND email = ?)`,
    [username, input.email || ""],
  );
  if (existing) throw new Error("用户名或邮箱已存在");

  const passwordHash = await bcrypt.hash(password, 10);
  const createdAt = nowIso();
  const user = {
    id: uuidv4(),
    username,
    email: String(input.email || "").trim() || null,
    passwordHash,
    displayName: String(input.displayName || input.username || "").trim() || username,
    role: input.role || PLATFORM_ROLES.USER,
    status: input.status || "active",
    subscriberId: input.subscriberId || null,
    data: input.data || {},
    createdAt,
    updatedAt: createdAt,
  };

  db.run(
    `INSERT INTO platformUsers(id, username, email, passwordHash, displayName, role, status, subscriberId, data, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.username,
      user.email,
      user.passwordHash,
      user.displayName,
      user.role,
      user.status,
      user.subscriberId,
      stringifyJson(user.data),
      user.createdAt,
      user.updatedAt,
    ],
  );

  return cleanUser(user);
}

export async function updatePlatformUser(id, updates) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM platformUsers WHERE id = ?`, [id]);
  if (!row) return null;

  const current = cleanUser(row);
  const next = {
    ...current,
    ...updates,
    username: current.username,
    data: { ...(current.data || {}), ...(updates.data || {}) },
    updatedAt: nowIso(),
  };
  let passwordHash = row.passwordHash;
  if (updates.password) {
    const password = String(updates.password);
    if (password.length < 8 || password.length > 72) throw new Error("密码长度需为 8-72 位");
    passwordHash = await bcrypt.hash(password, 10);
  }

  db.run(
    `UPDATE platformUsers
     SET email = ?, passwordHash = ?, displayName = ?, role = ?, status = ?, subscriberId = ?, data = ?, updatedAt = ?
     WHERE id = ?`,
    [
      String(next.email || "").trim() || null,
      passwordHash,
      String(next.displayName || next.username).trim(),
      next.role || PLATFORM_ROLES.USER,
      next.status || "active",
      next.subscriberId || null,
      stringifyJson(next.data || {}),
      next.updatedAt,
      id,
    ],
  );

  return getPlatformUserById(id);
}

export async function validatePlatformUserCredentials(username, password) {
  const user = await getPlatformUserByUsername(username, { includePassword: true });
  if (!user) return null;
  if (user.status !== "active") throw new Error("用户已被禁用");
  const ok = await bcrypt.compare(String(password || ""), user.passwordHash);
  if (!ok) return null;
  delete user.passwordHash;
  return user;
}

export function getUserPermissions(user) {
  const role = user?.role || PLATFORM_ROLES.USER;
  const isAdmin = hasRole(user, PLATFORM_ROLES.ADMIN);
  return {
    role,
    platformAdmin: isAdmin,
    sidebar_settings: isAdmin,
    sidebar_modules: isAdmin
      ? {}
      : {
          admin: false,
          system: false,
          platform: {
            enabled: true,
            overview: true,
            analytics: true,
            apiKeys: true,
            logs: true,
            wallet: true,
            profile: true,
            catalog: true,
          },
        },
  };
}

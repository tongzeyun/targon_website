/**
 * 认证接口输入校验 — 手工校验，不引入 Zod。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_PASSWORD_LEN = 128;
const MAX_FULL_NAME_LEN = 100;
const MIN_PASSWORD_LEN = 8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateEmailField(
  raw: unknown,
  fields: Record<string, string>,
  required = true,
): string | null {
  if (raw === undefined || raw === null || raw === "") {
    if (required) fields.email = "请输入有效邮箱";
    return null;
  }
  if (typeof raw !== "string") {
    fields.email = "请输入有效邮箱";
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    fields.email = "请输入有效邮箱";
    return null;
  }
  if (trimmed.length > MAX_EMAIL_LEN) {
    fields.email = "请输入有效邮箱";
    return null;
  }
  if (!EMAIL_RE.test(trimmed)) {
    fields.email = "请输入有效邮箱";
    return null;
  }
  return trimmed.toLowerCase();
}

function validatePasswordField(raw: unknown, fields: Record<string, string>): string | null {
  if (raw === undefined || raw === null || raw === "") {
    fields.password = "请输入密码";
    return null;
  }
  if (typeof raw !== "string") {
    fields.password = "请输入密码";
    return null;
  }
  if (raw.length < MIN_PASSWORD_LEN) {
    fields.password = "密码至少 8 位";
    return null;
  }
  if (raw.length > MAX_PASSWORD_LEN) {
    fields.password = "密码过长";
    return null;
  }
  return raw;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; fields: Record<string, string> };

export function validateRegisterBody(body: unknown): ValidationResult<RegisterInput> {
  if (!isPlainObject(body)) {
    return { ok: false, fields: { email: "请输入有效邮箱", password: "请输入密码" } };
  }

  const fields: Record<string, string> = {};
  const email = validateEmailField(body.email, fields);
  const password = validatePasswordField(body.password, fields);

  let fullName: string | undefined;
  if ("fullName" in body && body.fullName !== undefined && body.fullName !== null) {
    if (typeof body.fullName !== "string") {
      fields.fullName = "姓名格式不正确";
    } else {
      const trimmed = body.fullName.trim();
      if (trimmed.length > MAX_FULL_NAME_LEN) {
        fields.fullName = "姓名过长";
      } else if (trimmed) {
        fullName = trimmed;
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: {
      email: email!,
      password: password!,
      ...(fullName !== undefined ? { fullName } : {}),
    },
  };
}

export function validateLoginBody(body: unknown): ValidationResult<LoginInput> {
  if (!isPlainObject(body)) {
    return { ok: false, fields: { email: "请输入有效邮箱", password: "请输入密码" } };
  }

  const fields: Record<string, string> = {};
  const email = validateEmailField(body.email, fields);
  const password = validatePasswordField(body.password, fields);

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  return { ok: true, value: { email: email!, password: password! } };
}

/** PostgreSQL users.email 唯一约束冲突识别（自身不得抛异常） */
export function isUsersEmailUniqueViolation(error: unknown): boolean {
  try {
    if (error === null || error === undefined) return false;
    if (typeof error !== "object") return false;

    const pg = error as {
      code?: unknown;
      constraint?: unknown;
      table?: unknown;
      column?: unknown;
      detail?: unknown;
    };

    if (pg.code !== "23505") return false;
    if (pg.constraint === "users_email_key") return true;
    if (pg.table === "users" && pg.column === "email") return true;
    if (pg.table === "users" && typeof pg.detail === "string" && pg.detail.includes("(email)=")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

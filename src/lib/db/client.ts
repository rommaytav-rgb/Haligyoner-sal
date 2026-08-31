/**
 * SQLite access layer, built on Node's built-in `node:sqlite`.
 *
 * The database is opened once per process and the schema is applied on first
 * use, so a fresh checkout runs with no migration step.
 */

import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type SqlValue = string | number | null;
/** A column read out of a row: absent columns read as `undefined`. */
export type Cell = SqlValue | undefined;
export type Row = Record<string, SqlValue>;

let instance: DatabaseSync | null = null;

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH;
  if (configured && configured.length > 0) return configured;
  return path.join(process.cwd(), 'data', 'app.db');
}

function applySchema(db: DatabaseSync): void {
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  db.exec(readFileSync(schemaPath, 'utf8'));
}

export function getDb(): DatabaseSync {
  if (instance) return instance;
  const db = new DatabaseSync(resolveDatabasePath());
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  applySchema(db);
  instance = db;
  return db;
}

/** Opens an isolated in-memory database. Used by tests. */
export function createMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  applySchema(db);
  return db;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

function prepare(db: DatabaseSync, sql: string): StatementSync {
  return db.prepare(sql);
}

export function all<T = Row>(db: DatabaseSync, sql: string, params: SqlValue[] = []): T[] {
  return prepare(db, sql).all(...params) as T[];
}

export function get<T = Row>(db: DatabaseSync, sql: string, params: SqlValue[] = []): T | null {
  const row = prepare(db, sql).get(...params);
  return (row as T | undefined) ?? null;
}

export function run(db: DatabaseSync, sql: string, params: SqlValue[] = []): void {
  prepare(db, sql).run(...params);
}

/** Runs `fn` inside a transaction, rolling back on any throw. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

/** SQLite stores booleans as 0/1. */
export function toBool(value: Cell): boolean {
  return value === 1 || value === '1' || value === 'true';
}

export function fromBool(value: boolean): number {
  return value ? 1 : 0;
}

/** Reads a required text column. */
export function str(value: Cell, fallback = ''): string {
  return value === null || value === undefined ? fallback : String(value);
}

/** Reads an optional text column, preserving SQL NULL as `null`. */
export function optStr(value: Cell): string | null {
  return value === null || value === undefined ? null : String(value);
}

/** Reads a required numeric column. */
export function num(value: Cell, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Reads an optional numeric column, preserving SQL NULL as `null`. */
export function optNum(value: Cell): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseJson<T>(value: Cell, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

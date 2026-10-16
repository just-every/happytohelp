import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';

export const identifier = value => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw Error('Unsafe SQL identifier');
  return '`' + value + '`';
};
export async function connectLegacy(env = process.env) {
  for (const name of ['LEGACY_MYSQL_HOST','LEGACY_MYSQL_DATABASE','LEGACY_MYSQL_USER','LEGACY_MYSQL_PASSWORD'])
    if (env[name] === undefined || env[name] === '') throw Error(`Set ${name} explicitly`);
  const port = Number(env.LEGACY_MYSQL_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid LEGACY_MYSQL_PORT');
  return mysql.createConnection({
    host: env.LEGACY_MYSQL_HOST, port, database: env.LEGACY_MYSQL_DATABASE,
    user: env.LEGACY_MYSQL_USER, password: env.LEGACY_MYSQL_PASSWORD,
    ...(env.LEGACY_MYSQL_SSL_CA ? {ssl: {ca: await readFile(env.LEGACY_MYSQL_SSL_CA), rejectUnauthorized: true}} : {}),
    charset: 'utf8mb4', timezone: 'Z', dateStrings: true,
    supportBigNumbers: true, bigNumberStrings: true, decimalNumbers: false, jsonStrings: true,
    multipleStatements: false, connectTimeout: 15000,
  });
}
// SELECTs and transaction/session control only. No locks or source mutations.
export async function snapshot(connection, read) {
  await connection.query("SET SESSION time_zone = '+00:00'");
  await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
  try { const result = await read(); await connection.query('COMMIT'); return result; }
  catch (error) { await connection.query('ROLLBACK'); throw error; }
}

import { stripVTControlCharacters } from "node:util";

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const d1Rows = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.result)) return value.result;
  throw new Error("Wrangler D1 list did not return a database array; refusing to create resources.");
};

export const d1DatabaseIdFromList = (json, databaseName) => {
  const row = d1Rows(json).find((entry) => entry?.name === databaseName);
  if (!row) return null;
  const id = row.uuid ?? row.id ?? row.database_id ?? null;
  if (typeof id !== "string" || !uuid.test(id)) throw new Error(`Wrangler returned an invalid D1 UUID for existing database ${databaseName}.`);
  return id;
};

/** Wrangler 4.129.1 R2 list uses labelled records, not the Queues table. */
export const r2BucketIsListed = (stdout, bucketName) => stripVTControlCharacters(stdout).split(/\r?\n/)
  .some((line) => /^\s*name:\s*(.*?)\s*$/.exec(line)?.[1] === bucketName);

export const queueIsListed = (stdout, queueName) => stripVTControlCharacters(stdout).split(/\r?\n/).some((line) => line
  .split(/[│|]/).map((cell) => cell.trim()).includes(queueName));

const createdD1Id = (output) => output.match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i)?.[0] ?? null;

export const provisionResources = async ({ run, resources }) => {
  const [listedDatabases, listedBuckets, listedQueues] = await Promise.all([
    run(["d1", "list", "--json"]),
    run(["r2", "bucket", "list"]),
    run(["queues", "list"]),
  ]);
  let databaseId = d1DatabaseIdFromList(JSON.parse(listedDatabases.stdout), resources.database);
  if (!databaseId) {
    const created = await run(["d1", "create", resources.database]);
    databaseId = createdD1Id(`${created.stdout}\n${created.stderr}`);
    if (!databaseId) throw new Error(`Wrangler created ${resources.database} but did not return its D1 UUID; no configuration was written.`);
  }
  if (!r2BucketIsListed(listedBuckets.stdout, resources.files)) {
    try {
      await run(["r2", "bucket", "create", resources.files]);
    } catch (error) {
      if (!(error instanceof Error) || !/already exists/i.test(error.message)) throw error;
    }
  }
  for (const queue of [resources.jobs, resources.jobsDeadLetter]) {
    if (!queueIsListed(listedQueues.stdout, queue)) {
      try {
        await run(["queues", "create", queue]);
      } catch (error) {
        if (!(error instanceof Error) || !/already exists/i.test(error.message)) throw error;
      }
    }
  }
  return { databaseId };
};

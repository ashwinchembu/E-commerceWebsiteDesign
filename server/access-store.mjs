import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { MongoClient } from "mongodb";

function createSqliteStore(dataDirectory) {
  mkdirSync(dataDirectory, { recursive: true });
  const database = new DatabaseSync(path.join(dataDirectory, "access.sqlite"));

  return {
    backend: "sqlite",

    async initialize() {
      database.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS access_grants (
          id TEXT PRIMARY KEY,
          salt TEXT NOT NULL,
          secret_hash TEXT NOT NULL,
          label TEXT NOT NULL,
          email TEXT,
          role TEXT NOT NULL DEFAULT 'visitor',
          notes TEXT,
          created_at INTEGER NOT NULL,
          expires_at INTEGER,
          max_uses INTEGER NOT NULL DEFAULT 25,
          max_ips INTEGER NOT NULL DEFAULT 3,
          use_count INTEGER NOT NULL DEFAULT 0,
          last_used_at INTEGER,
          revoked_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS access_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          grant_id TEXT,
          result TEXT NOT NULL,
          ip TEXT NOT NULL,
          city TEXT,
          region TEXT,
          country TEXT,
          latitude TEXT,
          longitude TEXT,
          postal_code TEXT,
          asn TEXT,
          user_agent TEXT,
          client_meta TEXT,
          requested_path TEXT,
          occurred_at INTEGER NOT NULL,
          FOREIGN KEY (grant_id) REFERENCES access_grants(id)
        );

        CREATE INDEX IF NOT EXISTS access_events_ip_time
          ON access_events(ip, occurred_at);
        CREATE INDEX IF NOT EXISTS access_events_grant_time
          ON access_events(grant_id, occurred_at);
      `);

      const eventColumns = new Set(
        database.prepare("PRAGMA table_info(access_events)").all().map((column) => column.name),
      );
      for (const [column, definition] of [
        ["latitude", "TEXT"],
        ["longitude", "TEXT"],
        ["postal_code", "TEXT"],
        ["asn", "TEXT"],
        ["client_meta", "TEXT"],
        ["requested_path", "TEXT"],
      ]) {
        if (!eventColumns.has(column)) {
          database.exec(`ALTER TABLE access_events ADD COLUMN ${column} ${definition}`);
        }
      }
    },

    async deleteEventsBefore(cutoff) {
      database.prepare("DELETE FROM access_events WHERE occurred_at < ?").run(cutoff);
    },

    async countRecentFailures(ip, since) {
      return Number(database.prepare(`
        SELECT COUNT(*) AS count FROM access_events
        WHERE ip = ? AND result IN ('denied', 'rate_limited', 'ip_limit') AND occurred_at >= ?
      `).get(ip, since).count);
    },

    async getGrant(id) {
      return database.prepare("SELECT * FROM access_grants WHERE id = ?").get(id) || null;
    },

    async insertGrant(grant) {
      database.prepare(`
        INSERT INTO access_grants (
          id, salt, secret_hash, label, email, role, notes, created_at, expires_at, max_uses, max_ips
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        grant.id,
        grant.salt,
        grant.secretHash,
        grant.label,
        grant.email,
        grant.role,
        grant.notes,
        grant.createdAt,
        grant.expiresAt,
        grant.maxUses,
        grant.maxIps,
      );
    },

    async consumeGrant(id, ip, accessTime) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const grant = database.prepare("SELECT * FROM access_grants WHERE id = ?").get(id);
        const invalid = !grant
          || grant.revoked_at
          || (grant.expires_at && grant.expires_at <= accessTime)
          || (grant.max_uses > 0 && grant.use_count >= grant.max_uses);
        if (invalid) {
          database.exec("ROLLBACK");
          return { status: "invalid", grant: grant || null };
        }

        const knownIp = database.prepare(`
          SELECT 1 FROM access_events
          WHERE grant_id = ? AND result = 'allowed' AND ip = ?
          LIMIT 1
        `).get(id, ip);
        const uniqueIps = Number(database.prepare(`
          SELECT COUNT(DISTINCT ip) AS count
          FROM access_events
          WHERE grant_id = ? AND result = 'allowed'
        `).get(id).count);
        if (!knownIp && grant.max_ips > 0 && uniqueIps >= grant.max_ips) {
          database.exec("ROLLBACK");
          return { status: "ip_limit", grant };
        }

        database.prepare(`
          UPDATE access_grants
          SET use_count = use_count + 1, last_used_at = ?
          WHERE id = ?
        `).run(accessTime, id);
        const updatedGrant = database.prepare("SELECT * FROM access_grants WHERE id = ?").get(id);
        database.exec("COMMIT");
        return { status: "ok", grant: updatedGrant };
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },

    async insertEvent(event) {
      database.prepare(`
        INSERT INTO access_events (
          grant_id, result, ip, city, region, country, latitude, longitude, postal_code, asn,
          user_agent, client_meta, requested_path, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.grantId,
        event.result,
        event.ip,
        event.city,
        event.region,
        event.country,
        event.latitude,
        event.longitude,
        event.postalCode,
        event.asn,
        event.userAgent,
        event.clientMeta,
        event.requestedPath,
        event.occurredAt,
      );
    },

    async listGrants() {
      return database.prepare(`
        SELECT id, label, email, role, notes, created_at, expires_at, max_uses, max_ips,
               use_count, last_used_at, revoked_at
        FROM access_grants
        ORDER BY created_at DESC
      `).all();
    },

    async listEvents(limit) {
      return database.prepare(`
        SELECT e.id, e.grant_id, e.result, e.ip, e.city, e.region, e.country,
               e.latitude, e.longitude, e.postal_code, e.asn, e.user_agent,
               e.client_meta, e.requested_path, e.occurred_at, g.label, g.email
        FROM access_events e
        LEFT JOIN access_grants g ON g.id = e.grant_id
        ORDER BY e.occurred_at DESC
        LIMIT ?
      `).all(limit);
    },

    async revokeGrant(id, revokedAt) {
      return database.prepare(`
        UPDATE access_grants
        SET revoked_at = ?
        WHERE id = ? AND revoked_at IS NULL
      `).run(revokedAt, id).changes > 0;
    },

    async close() {
      database.close();
    },
  };
}

function createMongoStore(mongoUrl, databaseName) {
  const client = new MongoClient(mongoUrl, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
  });
  const database = client.db(databaseName);
  const grants = database.collection("access_grants");
  const events = database.collection("access_events");
  const withoutMongoId = { projection: { _id: 0 } };

  return {
    backend: "mongodb",

    async initialize() {
      await client.connect();
      await Promise.all([
        grants.createIndex({ id: 1 }, { unique: true }),
        events.createIndex({ ip: 1, occurred_at: -1 }),
        events.createIndex({ grant_id: 1, occurred_at: -1 }),
        events.createIndex({ occurred_at: 1 }),
      ]);
    },

    async deleteEventsBefore(cutoff) {
      await events.deleteMany({ occurred_at: { $lt: cutoff } });
    },

    async countRecentFailures(ip, since) {
      return events.countDocuments({
        ip,
        result: { $in: ["denied", "rate_limited", "ip_limit"] },
        occurred_at: { $gte: since },
      });
    },

    async getGrant(id) {
      return grants.findOne({ id }, withoutMongoId);
    },

    async insertGrant(grant) {
      await grants.insertOne({
        id: grant.id,
        salt: grant.salt,
        secret_hash: grant.secretHash,
        label: grant.label,
        email: grant.email,
        role: grant.role,
        notes: grant.notes,
        created_at: grant.createdAt,
        expires_at: grant.expiresAt,
        max_uses: grant.maxUses,
        max_ips: grant.maxIps,
        use_count: 0,
        last_used_at: null,
        revoked_at: null,
        allowed_ips: [],
      });
    },

    async consumeGrant(id, ip, accessTime) {
      const current = await grants.findOne({ id }, withoutMongoId);
      const invalid = !current
        || current.revoked_at
        || (current.expires_at && current.expires_at <= accessTime)
        || (current.max_uses > 0 && current.use_count >= current.max_uses);
      if (invalid) return { status: "invalid", grant: current || null };

      const maxUsesExpression = {
        $or: [
          { $lte: ["$max_uses", 0] },
          { $lt: ["$use_count", "$max_uses"] },
        ],
      };
      const commonFilter = {
        id,
        revoked_at: null,
        $or: [{ expires_at: null }, { expires_at: { $gt: accessTime } }],
        $expr: maxUsesExpression,
      };
      const knownIp = Array.isArray(current.allowed_ips) && current.allowed_ips.includes(ip);
      const update = {
        $inc: { use_count: 1 },
        $set: { last_used_at: accessTime },
      };
      let filter = commonFilter;

      if (!knownIp && current.max_ips > 0) {
        filter = {
          ...commonFilter,
          $expr: {
            $and: [
              maxUsesExpression,
              {
                $lt: [
                  { $size: { $ifNull: ["$allowed_ips", []] } },
                  "$max_ips",
                ],
              },
            ],
          },
        };
        update.$addToSet = { allowed_ips: ip };
      } else if (!knownIp) {
        update.$addToSet = { allowed_ips: ip };
      }

      const updated = await grants.findOneAndUpdate(filter, update, {
        returnDocument: "after",
        projection: { _id: 0 },
      });
      if (updated) return { status: "ok", grant: updated };

      const latest = await grants.findOne({ id }, withoutMongoId);
      const ipLimitReached = !knownIp
        && latest
        && latest.max_ips > 0
        && Array.isArray(latest.allowed_ips)
        && latest.allowed_ips.length >= latest.max_ips;
      return { status: ipLimitReached ? "ip_limit" : "invalid", grant: latest };
    },

    async insertEvent(event) {
      await events.insertOne({
        grant_id: event.grantId,
        result: event.result,
        ip: event.ip,
        city: event.city,
        region: event.region,
        country: event.country,
        latitude: event.latitude,
        longitude: event.longitude,
        postal_code: event.postalCode,
        asn: event.asn,
        user_agent: event.userAgent,
        client_meta: event.clientMeta,
        requested_path: event.requestedPath,
        occurred_at: event.occurredAt,
      });
    },

    async listGrants() {
      return grants.find(
        {},
        {
          projection: {
            _id: 0,
            salt: 0,
            secret_hash: 0,
            allowed_ips: 0,
          },
        },
      ).sort({ created_at: -1 }).toArray();
    },

    async listEvents(limit) {
      const rows = await events.aggregate([
        { $sort: { occurred_at: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "access_grants",
            localField: "grant_id",
            foreignField: "id",
            as: "grant",
          },
        },
        { $set: { grant: { $first: "$grant" } } },
        {
          $project: {
            grant_id: 1,
            result: 1,
            ip: 1,
            city: 1,
            region: 1,
            country: 1,
            latitude: 1,
            longitude: 1,
            postal_code: 1,
            asn: 1,
            user_agent: 1,
            client_meta: 1,
            requested_path: 1,
            occurred_at: 1,
            label: "$grant.label",
            email: "$grant.email",
          },
        },
      ]).toArray();

      return rows.map(({ _id, ...row }) => ({ id: String(_id), ...row }));
    },

    async revokeGrant(id, revokedAt) {
      const result = await grants.updateOne(
        { id, revoked_at: null },
        { $set: { revoked_at: revokedAt } },
      );
      return result.modifiedCount > 0;
    },

    async close() {
      await client.close();
    },
  };
}

export function createAccessStore({ mongoUrl, mongoDatabase, dataDirectory }) {
  return mongoUrl
    ? createMongoStore(mongoUrl, mongoDatabase || "manoir_kits_access")
    : createSqliteStore(dataDirectory);
}

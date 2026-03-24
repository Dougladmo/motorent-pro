import Database from 'better-sqlite3';

// Module-level singleton
let db: Database.Database | null = null;
let mockClientInstance: MockSupabaseClient | null = null;

// Tables whose boolean columns must be converted between SQLite integers and JS booleans
const BOOLEAN_FIELDS: Record<string, string[]> = {
  subscribers: ['active', 'is_real_driver'],
  rentals: ['is_active'],
  payments: ['is_amount_overridden']
};

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS motorcycles (
      id TEXT PRIMARY KEY,
      plate TEXT NOT NULL UNIQUE,
      chassi TEXT NOT NULL DEFAULT '',
      renavam TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      mileage INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Disponível',
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscribers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      document TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      birth_date TEXT,
      address_zip TEXT,
      address_street TEXT,
      address_number TEXT,
      address_complement TEXT,
      address_neighborhood TEXT,
      address_city TEXT,
      address_state TEXT,
      is_real_driver INTEGER NOT NULL DEFAULT 1,
      real_driver_name TEXT,
      real_driver_document TEXT,
      real_driver_phone TEXT,
      real_driver_relationship TEXT,
      real_driver_address_zip TEXT,
      real_driver_address_street TEXT,
      real_driver_address_number TEXT,
      real_driver_address_complement TEXT,
      real_driver_address_neighborhood TEXT,
      real_driver_address_city TEXT,
      real_driver_address_state TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rentals (
      id TEXT PRIMARY KEY,
      motorcycle_id TEXT NOT NULL,
      subscriber_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      weekly_value REAL NOT NULL,
      due_day_of_week INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      terminated_at TEXT,
      termination_reason TEXT,
      outstanding_balance REAL NOT NULL DEFAULT 0,
      total_contract_value REAL NOT NULL DEFAULT 0,
      total_paid REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      rental_id TEXT NOT NULL,
      subscriber_name TEXT NOT NULL,
      amount REAL NOT NULL,
      expected_amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pendente',
      paid_at TEXT,
      marked_as_paid_at TEXT,
      previous_status TEXT,
      is_amount_overridden INTEGER NOT NULL DEFAULT 0,
      reminder_sent_count INTEGER NOT NULL DEFAULT 0,
      abacate_pix_id TEXT,
      pix_br_code TEXT,
      pix_expires_at TEXT,
      pix_qr_code_url TEXT,
      pix_payment_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriber_documents (
      id TEXT PRIMARY KEY,
      subscriber_id TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'other',
      description TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(':memory:');
    initSchema(db);
  }
  return db;
}

export function resetDb(): void {
  const database = getDb();
  database.exec(`
    DELETE FROM subscriber_documents;
    DELETE FROM payments;
    DELETE FROM rentals;
    DELETE FROM subscribers;
    DELETE FROM motorcycles;
  `);
}

// Convert SQLite row booleans back to JS booleans
function convertBooleans(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const fields = BOOLEAN_FIELDS[table] || [];
  const result = { ...row };
  for (const field of fields) {
    if (field in result && result[field] !== null && result[field] !== undefined) {
      result[field] = result[field] === 1 || result[field] === true;
    }
  }
  return result;
}

// Convert JS booleans to SQLite integers before writing
function prepareBooleans(table: string, data: Record<string, unknown>): Record<string, unknown> {
  const fields = BOOLEAN_FIELDS[table] || [];
  const result = { ...data };
  for (const field of fields) {
    if (field in result && result[field] !== null && result[field] !== undefined) {
      result[field] = result[field] ? 1 : 0;
    }
  }
  return result;
}

type QueryResult = { data: unknown; error: null } | { data: null; error: { message: string; code?: string } };

class SupabaseQueryBuilder {
  private table: string;
  private database: Database.Database;
  private conditions: string[] = [];
  private conditionValues: unknown[] = [];
  private limitValue: number | null = null;
  private isSingle = false;
  // 'select' is also used as the "return rows" mode for insert/update/delete
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private insertData: unknown = null;
  private updateData: Record<string, unknown> | null = null;
  private selectColumns = '*';
  private inField: string | null = null;
  private inValues: unknown[] = [];
  private isField: string | null = null;
  // Whether .select() was chained after insert/update to request return data
  private returningRows = false;

  constructor(table: string, database: Database.Database) {
    this.table = table;
    this.database = database;
  }

  select(columns = '*'): this {
    if (this.operation === 'select') {
      // Initial select call
      this.operation = 'select';
    } else {
      // Chained after insert/update/delete — means "return the rows"
      this.returningRows = true;
    }
    this.selectColumns = columns;
    return this;
  }

  insert(data: unknown): this {
    this.operation = 'insert';
    this.insertData = data;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.operation = 'update';
    this.updateData = data;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    const boolFields = BOOLEAN_FIELDS[this.table] || [];
    let val = value;
    if (boolFields.includes(column) && typeof value === 'boolean') {
      val = value ? 1 : 0;
    }
    this.conditions.push(`${column} = ?`);
    this.conditionValues.push(val);
    return this;
  }

  lt(column: string, value: unknown): this {
    this.conditions.push(`${column} < ?`);
    this.conditionValues.push(value);
    return this;
  }

  gte(column: string, value: unknown): this {
    this.conditions.push(`${column} >= ?`);
    this.conditionValues.push(value);
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.inField = column;
    this.inValues = values;
    return this;
  }

  is(column: string, _value: null): this {
    this.isField = column;
    return this;
  }

  order(_column: string, _opts?: { ascending?: boolean }): this {
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  single(): this {
    this.isSingle = true;
    return this;
  }

  private buildWhere(): { clause: string; values: unknown[] } {
    const parts: string[] = [...this.conditions];
    const values: unknown[] = [...this.conditionValues];

    if (this.inField && this.inValues.length > 0) {
      const placeholders = this.inValues.map(() => '?').join(', ');
      parts.push(`${this.inField} IN (${placeholders})`);
      values.push(...this.inValues);
    }

    if (this.isField !== null) {
      parts.push(`${this.isField} IS NULL`);
    }

    const clause = parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '';
    return { clause, values };
  }

  private readRows(whereClause: string, whereValues: unknown[]): Record<string, unknown>[] {
    let sql = `SELECT ${this.selectColumns} FROM ${this.table} ${whereClause}`;
    if (this.limitValue !== null) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    const rows = this.database.prepare(sql).all(...whereValues) as Record<string, unknown>[];
    return rows.map(r => convertBooleans(this.table, r));
  }

  private executeSelect(): QueryResult {
    try {
      const { clause, values } = this.buildWhere();
      const converted = this.readRows(clause, values);

      if (this.isSingle) {
        if (converted.length === 0) {
          return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
        }
        return { data: converted[0], error: null };
      }

      return { data: converted, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: null, error: { message: msg } };
    }
  }

  private executeInsert(): QueryResult {
    try {
      const now = new Date().toISOString();
      const rawItems = Array.isArray(this.insertData) ? this.insertData : [this.insertData];

      const insertedIds: string[] = [];

      for (const rawItem of rawItems) {
        const item = { ...(rawItem as Record<string, unknown>) };
        if (!item.id) {
          item.id = generateUUID();
        }
        if (!item.created_at) {
          item.created_at = now;
        }
        const tablesWithoutUpdatedAt = ['subscriber_documents'];
        if (!tablesWithoutUpdatedAt.includes(this.table) && !item.updated_at) {
          item.updated_at = now;
        }

        const prepared = prepareBooleans(this.table, item);
        const columns = Object.keys(prepared);
        const placeholders = columns.map(() => '?').join(', ');
        const rowValues = Object.values(prepared);
        const sql = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders})`;

        try {
          this.database.prepare(sql).run(...rowValues);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return { data: null, error: { message: msg } };
        }

        insertedIds.push(item.id as string);
      }

      // If .select() was chained, return inserted rows
      if (this.returningRows || this.isSingle) {
        const inserted: Record<string, unknown>[] = insertedIds.map(id => {
          const row = this.database.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id) as Record<string, unknown>;
          return convertBooleans(this.table, row);
        });

        if (this.isSingle) {
          return { data: inserted[0], error: null };
        }
        return { data: inserted, error: null };
      }

      return { data: null, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: null, error: { message: msg } };
    }
  }

  private executeUpdate(): QueryResult {
    try {
      const now = new Date().toISOString();
      const tablesWithoutUpdatedAt = ['subscriber_documents'];
      const updates = tablesWithoutUpdatedAt.includes(this.table)
        ? { ...(this.updateData || {}) }
        : { ...(this.updateData || {}), updated_at: now };
      const prepared = prepareBooleans(this.table, updates);

      const { clause, values: whereValues } = this.buildWhere();

      const setCols = Object.keys(prepared).filter(k => k !== 'id');
      const setClause = setCols.map(c => `${c} = ?`).join(', ');
      const setValues = setCols.map(c => prepared[c]);

      const sql = `UPDATE ${this.table} SET ${setClause} ${clause}`;
      this.database.prepare(sql).run(...setValues, ...whereValues);

      // If .select() was chained, return updated rows
      if (this.returningRows || this.isSingle) {
        const converted = this.readRows(clause, whereValues);

        if (this.isSingle) {
          if (converted.length === 0) {
            return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
          }
          return { data: converted[0], error: null };
        }
        return { data: converted, error: null };
      }

      return { data: null, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: null, error: { message: msg } };
    }
  }

  private executeDelete(): QueryResult {
    try {
      const { clause, values } = this.buildWhere();
      const sql = `DELETE FROM ${this.table} ${clause}`;
      this.database.prepare(sql).run(...values);
      return { data: null, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: null, error: { message: msg } };
    }
  }

  // Make builder thenable so `await builder` works
  then(
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown
  ): Promise<unknown> {
    let result: QueryResult;
    try {
      switch (this.operation) {
        case 'select':
          result = this.executeSelect();
          break;
        case 'insert':
          result = this.executeInsert();
          break;
        case 'update':
          result = this.executeUpdate();
          break;
        case 'delete':
          result = this.executeDelete();
          break;
        default:
          result = { data: null, error: { message: 'Unknown operation' } };
      }
    } catch (err) {
      if (reject) return Promise.resolve(reject(err));
      return Promise.reject(err);
    }
    return Promise.resolve(resolve(result));
  }
}

class MockSupabaseClient {
  private database: Database.Database;

  constructor(database: Database.Database) {
    this.database = database;
  }

  from(table: string): SupabaseQueryBuilder {
    return new SupabaseQueryBuilder(table, this.database);
  }

  rpc(_name: string): Promise<{ data: null; error: { message: string } }> {
    return Promise.resolve({ data: null, error: { message: 'RPC not supported in tests' } });
  }
}

export function getMockClient(): MockSupabaseClient {
  if (!mockClientInstance) {
    mockClientInstance = new MockSupabaseClient(getDb());
  }
  return mockClientInstance;
}

export function resetMockClient(): void {
  mockClientInstance = null;
}

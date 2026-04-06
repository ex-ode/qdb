import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * A lightweight key-value store backed by SQLite, designed for Bun
 * Supports dot-notation paths for nested value access (e.g. "users.alice.age")
 * All values are JSON-serialized before storage
 */
export class QDB {
    private db: Database;

    /**
     * Initializes the database, creating the directory and SQLite file if needed
     * @param path - Directory where the `db.sqlite` file will be stored
     */
    constructor(path = `${process.cwd()}/db`)
    {
        if (!existsSync(path))
        {
            mkdirSync(path, { recursive: true });
        };

        this.db = new Database(join(path, "db.sqlite"));

        this.db.run(`
            CREATE TABLE IF NOT EXISTS kv (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        `);
    };

    /** Retrieves and parses the JSON value stored under a root key */
    private getRoot(root: string): any
    {
        const row = this.db
        .query<{ value: string }, [string]>("SELECT value FROM kv WHERE key = ?")
        .get(root);

        return row ? JSON.parse(row.value) : null;
    };

    /** Serializes a value to JSON and upserts it under a root key */
    private setRoot(root: string, value: any): void
    {
        this.db
        .query("INSERT OR REPLACE INTO kv (key, value) VALUES (?,?)")
        .run(root, JSON.stringify(value));
    };

    /**
     * Walks an object along the given path segments and returns the parent object and final key
     * When `create` is true, missing intermediate objects are created on the fly
     * Returns null if the path cannot be resolved
     */
    private resolvePath(obj: Record<string, any>, parts: string[], create = false): { parent: Record<string, any>; key: string } | null
    {
        let current: Record<string, any> = obj;

        for (let i = 0; i < parts.length - 1; i++)
        {
            const part = parts[i]!;

            if (typeof current[part] !== "object" || current[part] === null)
            {
                if (!create) return null;
                current[part] = {};
            };

            current = current[part];
        }

        const key = parts.at(-1);
        if (!key) return null;

        return { parent: current, key };
    };

    /**
     * Retrieves the value at the given dot-notation path
     * Returns null if the path does not exist
     */
    public get<T = unknown>(path: string): T | null {
        if (!path) return null;

        const parts = path.split(".");
        const root = parts.shift()!;

        const data = this.getRoot(root);
        if (data === null) return null;

        if (parts.length === 0) return (data as T) ?? null;

        let current: any = data;

        for (const part of parts)
        {
            if (current === null || typeof current !== "object" || !(part in current))
                return null;
            current = current[part];
        };
        return (current as T) ?? null;
    };

    /**
     * Stores a value at the given dot-notation path
     * Intermediate objects are created automatically if they don't exist
     * Returns the stored value
     */
    public set<T = unknown>(path: string, value: T): T
    {
        if (!path) return value;

        const parts = path.split(".");
        const root = parts[0]!;

        if (parts.length === 1)
        {
            this.setRoot(root, value);
            return value;
        };

        let data: any = this.getRoot(root);

        if (data === null || typeof data !== "object")
            data = {};

        const resolved = this.resolvePath(data, parts.slice(1), true);
        if (!resolved) return value;

        resolved.parent[resolved.key] = value;
        this.setRoot(root, data);

        return value;
    };

    /** Returns true if a value exists at the given path */
    public has(path: string): boolean
    {
        return this.get(path) !== null;
    };

    /**
     * Deletes the value at the given dot-notation path
     * Returns true if a value was actually removed, false otherwise
     */
    public delete(path: string): boolean
    {
        if (!path) return false;

        const parts = path.split(".");
        const root = parts[0]!;

        if (parts.length === 1)
        {
            const result = this.db
            .query("DELETE FROM kv WHERE key = ?")
            .run(root);

            return result.changes > 0;
        };

        const data = this.getRoot(root);
        if (data === null) return false;

        const resolved = this.resolvePath(data, parts.slice(1), false);
        if (!resolved || !(resolved.key in resolved.parent)) return false;

        delete resolved.parent[resolved.key];
        this.setRoot(root, data);

        return true;
    };

    /**
     * Adds the given amount to the numeric value at the path
     * If the key doesn't exist, it is initialized to 0 before adding
     * Returns the updated value
     */
    public add(path: string, amount: number): number
    {
        const current = this.get<number>(path) ?? 0;

        const updated = current + amount;
        this.set(path, updated);

        return updated;
    };
};
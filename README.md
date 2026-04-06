# QDB

A lightweight, zero-dependency key-value store for [Bun](https://bun.sh), backed by SQLite. Inspired by [Quick.db](https://github.com/plazzmo/quick.db).

> **Not designed for medium or large-scale infrastructure.** QDB is meant for small projects, prototypes, bots, or scripts where you need simple persistent storage without the overhead of a full database setup. If you need replication, sharding, high concurrency, or horizontal scaling, use a proper database.

## Features

- Simple `get` / `set` / `has` / `delete` / `add` API
- Dot-notation paths for nested values (e.g. `"users.alice.age"`)
- Automatic creation of intermediate objects
- JSON serialization under the hood
- Type-safe with TypeScript generics
- Uses Bun's native SQLite module — no external dependencies

## Usage

```ts
import { QDB } from "qdb";

const db = new QDB(); // stores in ./db/db.sqlite by default

// Basic operations
db.set("name", "Alice");
db.get("name"); // "Alice"
db.has("name"); // true
db.delete("name"); // true

// Nested paths
db.set("users.alice.age", 25);
db.get("users.alice.age"); // 25
db.get("users.alice"); // { age: 25 }

// Numeric operations
db.set("score", 10);
db.add("score", 5); // 15
db.add("score", -3); // 12
```

## API

| Method | Signature | Description |
|--------|-----------|-------------|
| **constructor** | `new QDB(path?)` | Creates a new database instance. `path` defaults to `./db` — the SQLite file is stored as `db.sqlite` inside that directory. |
| **get** | `db.get<T>(path): T \| null` | Returns the value at the given dot-notation path, or `null` if it doesn't exist. |
| **set** | `db.set<T>(path, value): T` | Stores a value at the given path. Intermediate objects are created automatically. |
| **has** | `db.has(path): boolean` | Returns `true` if a value exists at the given path. |
| **delete** | `db.delete(path): boolean` | Deletes the value at the given path. Returns `true` if something was removed. |
| **add** | `db.add(path, amount): number` | Adds `amount` to the numeric value at the path. Initializes to `0` if the key doesn't exist. |


## Why synchronous?

QDB uses Bun's native `bun:sqlite` driver, which is synchronous by design. Since SQLite operates on a local file with no network round-trips, synchronous calls are extremely fast and avoid the complexity of promises or callbacks. This keeps the API simple and predictable — no `await` needed.

> More methods will be added over time to progressively match the [Quick.db](https://github.com/plazzmo/quick.db) API.

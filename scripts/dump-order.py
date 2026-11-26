#!/usr/bin/env python3
"""Reorder a `wrangler d1 export` dump so D1 can import it with foreign keys on.

D1 cannot turn foreign keys off, and it runs the statements of `d1 execute
--file` one by one, so a dump is only importable when every row's parent table
(and parent row) already exists. `wrangler d1 export` writes each table's rows
directly after its CREATE TABLE, in creation order — which puts the rows of an
early table (lookup_options, created in 0001) before the tables its later ALTERed
columns reference (regional_churches in 0023, supervision_clusters in 0025). The
import then fails with `no such table: main.supervision_clusters`.

This script splits the dump into statements and rewrites the order:
  1. every CREATE TABLE (so all parent tables exist),
  2. every other CREATE (indexes, triggers, views),
  3. every INSERT, in dependency order (parents first, original order within a
     table).

It never changes a statement's text. Reference cycles (self references) keep the
original order, which is rowid order and therefore normally parent-first.

Usage: scripts/dump-order.py <dump.sql> <out.sql>
"""

import re
import sys


def split_statements(sql: str) -> list[str]:
    statements: list[str] = []
    buf: list[str] = []
    quote: str | None = None
    i = 0
    n = len(sql)
    while i < n:
        ch = sql[i]
        if quote:
            buf.append(ch)
            if ch == quote:
                # A doubled quote is an escaped quote, not the end of the string.
                if i + 1 < n and sql[i + 1] == quote:
                    buf.append(sql[i + 1])
                    i += 1
                else:
                    quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            buf.append(ch)
            i += 1
            continue
        if ch == "-" and i + 1 < n and sql[i + 1] == "-":
            end = sql.find("\n", i)
            if end < 0:
                break
            i = end + 1
            continue
        if ch == ";":
            statement = "".join(buf).strip()
            if statement:
                statements.append(statement)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


TABLE_RE = re.compile(r'^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["\']?([A-Za-z0-9_]+)', re.I)
INSERT_RE = re.compile(r'^\s*INSERT\s+(?:OR\s+\w+\s+)?INTO\s+["\']?([A-Za-z0-9_]+)', re.I)
REFS_RE = re.compile(r'REFERENCES\s+["\']?([A-Za-z0-9_]+)', re.I)
PRAGMA_RE = re.compile(r'^\s*PRAGMA\b', re.I)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: scripts/dump-order.py <dump.sql> <out.sql>", file=sys.stderr)
        return 2
    with open(sys.argv[1], encoding="utf-8") as fh:
        statements = split_statements(fh.read())

    tables: list[str] = []
    references: dict[str, set[str]] = {}
    creates: list[str] = []
    inserts: list[tuple[str, str]] = []

    for statement in statements:
        if PRAGMA_RE.match(statement):
            continue  # defer_foreign_keys cannot span D1's per-statement runs
        match = TABLE_RE.match(statement)
        if match:
            name = match.group(1)
            tables.append(name)
            references.setdefault(name, set()).update(REFS_RE.findall(statement))
            creates.append(statement)
            continue
        if INSERT_RE.match(statement):
            inserts.append((INSERT_RE.match(statement).group(1), statement))
            continue
        creates.append(statement)  # indexes, triggers, views

    # Depth-first topological order; a cycle falls back to the original order.
    order: list[str] = []
    seen: set[str] = set()
    visiting: set[str] = set()

    def visit(table: str) -> None:
        if table in seen or table in visiting:
            return
        visiting.add(table)
        for parent in sorted(references.get(table, ())):
            if parent in references:
                visit(parent)
        visiting.discard(table)
        seen.add(table)
        order.append(table)

    for table in tables:
        visit(table)

    rank = {table: index for index, table in enumerate(order)}
    inserts.sort(key=lambda pair: rank.get(pair[0], len(rank)))

    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        for statement in creates:
            fh.write(statement + ";\n")
        for _, statement in inserts:
            fh.write(statement + ";\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

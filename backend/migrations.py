"""
`create_all` makes missing tables but never alters existing ones, and a user's
data.db predates these columns. Rather than pull in a migration tool for two
columns, add what is missing at startup. Each entry is idempotent.
"""
from sqlalchemy import inspect, text

_COLUMNS = {
    "job_rows": {
        "sent_at": "DATETIME",
        "attempts": "INTEGER NOT NULL DEFAULT 0",
    },
}


def ensure_columns(engine) -> None:
    existing_tables = set(inspect(engine).get_table_names())
    for table, columns in _COLUMNS.items():
        if table not in existing_tables:
            continue  # create_all will build it with the columns already in
        have = {c["name"] for c in inspect(engine).get_columns(table)}
        with engine.begin() as conn:
            for name, ddl in columns.items():
                if name not in have:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))

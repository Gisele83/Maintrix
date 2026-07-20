#!/bin/bash
PGDATA="/home/runner/workspace/.pgdata"
PGPORT=5433

if [ ! -d "$PGDATA" ]; then
  echo "Initializing PostgreSQL data directory..."
  initdb -D "$PGDATA" --no-locale --encoding=UTF8
fi

if ! pg_ctl -D "$PGDATA" status > /dev/null 2>&1; then
  echo "Starting local PostgreSQL on port $PGPORT..."
  pg_ctl -D "$PGDATA" -l "$PGDATA/logfile" -o "-p $PGPORT -k /tmp" start
  sleep 2
fi

PGHOST=/tmp PGPORT=$PGPORT PGUSER=runner psql -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'maintrix'" | grep -q 1 || {
  echo "Creating maintrix database..."
  PGHOST=/tmp PGPORT=$PGPORT PGUSER=runner createdb maintrix
}

echo "Local PostgreSQL ready on port $PGPORT"
export DATABASE_URL="postgresql://runner@localhost:$PGPORT/maintrix?host=/tmp"
echo "DATABASE_URL=$DATABASE_URL"

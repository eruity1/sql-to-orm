import { SQL_PATTERNS } from "../constants";

const getTableNames = (query) => {
  const tables = [];

  const fromMatch = query.match(SQL_PATTERNS.TABLE_FROM);
  const intoMatch = query.match(SQL_PATTERNS.TABLE_INTO);
  const updateMatch = query.match(SQL_PATTERNS.TABLE_UPDATE);

  if (fromMatch) {
    const mainTable = fromMatch[1];
    const alias = fromMatch[2];
    tables.push({
      name: mainTable,
      type: "main",
      alias: alias || null,
    });
  } else if (intoMatch) {
    tables.push({ name: intoMatch[1], type: "main", alias: null });
  } else if (updateMatch) {
    tables.push({ name: updateMatch[1], type: "main", alias: null });
  }

  return tables;
};

const getColumns = (query) => {
  const lowerSQL = query.toLowerCase();

  if (lowerSQL.includes("select *"))
    return [{ name: "*", table: null, alias: null }];

  const selectMatch = query.match(SQL_PATTERNS.SELECT_COLUMNS);
  if (selectMatch) {
    return selectMatch[1].split(",").map((col) => {
      const cleaned = col.trim().replace(/`/g, "");

      const asMatch = cleaned.match(SQL_PATTERNS.COLUMN_AS);
      if (asMatch) {
        const [, columnPart, alias] = asMatch;
        if (columnPart.includes(".")) {
          const [table, column] = columnPart.split(".");
          return { name: column, table, alias };
        }
        return { name: columnPart, table: null, alias };
      }

      if (cleaned.includes(".")) {
        const [table, column] = cleaned.split(".");
        return { name: column, table, alias: null };
      }
      return { name: cleaned, table: null, alias: null };
    });
  }

  const insertMatch = query.match(SQL_PATTERNS.INSERT_COLUMNS);
  if (insertMatch) {
    return insertMatch[1].split(",").map((col) => ({
      name: col.trim().replace(/`/g, ""),
      table: null,
      alias: null,
    }));
  }

  return [];
};

const getJoins = (query) => {
  const joins = [];
  let match;

  while ((match = SQL_PATTERNS.JOIN_PATTERN.exec(query)) !== null) {
    const [, joinType, tableName, alias, onCondition] = match;
    joins.push({
      type: joinType.trim().toUpperCase(),
      table: tableName,
      alias: alias || null,
      on: onCondition.trim(),
    });
  }

  return joins;
};

const getValues = (query) => {
  const valuesMatch = query.match(SQL_PATTERNS.VALUES_CLAUSE);
  if (!valuesMatch) return null;

  const values = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = null;

  for (let char of valuesMatch[1]) {
    if ((char === "'" || char === '"') && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      current += char;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) values.push(current.trim());

  return values;
};

const getSetClause = (query) => {
  const setMatch = query.match(SQL_PATTERNS.SET_CLAUSE);
  if (!setMatch) return null;

  const pairs = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = null;

  for (let char of setMatch[1]) {
    if ((char === "'" || char === '"') && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      current += char;
    } else if (char === "," && !inQuotes) {
      pairs.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) pairs.push(current.trim());

  return pairs.map((pair) => {
    const [name, value] = pair
      .split("=")
      .map((s) => s.trim().replace(/`/g, ""));
    return { name, value };
  });
};

const getWhereConditions = (query) => {
  const whereMatch = query.match(SQL_PATTERNS.WHERE_CLAUSE);
  return whereMatch ? whereMatch[1].trim() : "";
};

const getGroupBy = (query) => {
  const groupMatch = query.match(SQL_PATTERNS.GROUP_BY_CLAUSE);
  if (!groupMatch) return null;

  return groupMatch[1].split(",").map((col) => {
    const cleaned = col.trim().replace(/`/g, "");
    if (cleaned.includes(".")) {
      const [table, column] = cleaned.split(".");
      return { name: column, table };
    }
    return { name: cleaned, table: null };
  });
};

const getHaving = (query) => {
  const havingMatch = query.match(SQL_PATTERNS.HAVING_CLAUSE);
  return havingMatch ? havingMatch[1].trim() : null;
};

const getOrderBy = (query) => {
  const orderMatch = query.match(SQL_PATTERNS.ORDER_BY_CLAUSE);
  if (!orderMatch) return null;

  return orderMatch[1].split(",").map((col) => {
    const parts = col.trim().replace(/`/g, "").split(/\s+/);
    const columnPart = parts[0];
    const direction = parts[1]?.toUpperCase() === "DESC" ? "DESC" : "ASC";

    if (columnPart.includes(".")) {
      const [table, column] = columnPart.split(".");
      return { name: column, table, direction };
    }

    return { name: columnPart, table: null, direction };
  });
};

const getLimit = (query) => {
  const limitMatch = query.match(SQL_PATTERNS.LIMIT_CLAUSE);
  if (!limitMatch) return null;

  return {
    count: parseInt(limitMatch[1]),
    offset: limitMatch[2] ? parseInt(limitMatch[2]) : null,
  };
};

const sqlParser = (sql) => {
  const trimmedSQL = sql.trim();
  const lowerSQL = trimmedSQL.toLowerCase();

  const tables = getTableNames(trimmedSQL);
  const columns = getColumns(trimmedSQL);
  const joins = getJoins(trimmedSQL);
  const whereClause = getWhereConditions(trimmedSQL);
  const values = lowerSQL.includes("insert") ? getValues(trimmedSQL) : null;
  const set = lowerSQL.includes("update") ? getSetClause(trimmedSQL) : null;
  const groupBy = getGroupBy(trimmedSQL);
  const having = getHaving(trimmedSQL);
  const orderBy = getOrderBy(trimmedSQL);
  const limit = getLimit(trimmedSQL);

  let queryType = "UNKNOWN";
  if (lowerSQL.startsWith("select")) queryType = "SELECT";
  else if (lowerSQL.startsWith("insert")) queryType = "INSERT";
  else if (lowerSQL.startsWith("update")) queryType = "UPDATE";
  else if (lowerSQL.startsWith("delete")) queryType = "DELETE";

  return {
    type: queryType,
    tables,
    columns,
    joins,
    where: whereClause,
    values,
    set,
    groupBy,
    having,
    orderBy,
    limit,
    mainTable: tables[0]?.name || "table",
  };
};

export default sqlParser;

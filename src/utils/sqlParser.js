const getTableNames = (query) => {
  const tables = [];
  const fromMatch = query.match(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  const intoMatch = query.match(/into\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  const updateMatch = query.match(/update\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);

  const mainTable = fromMatch?.[1] || intoMatch?.[1] || updateMatch?.[1];

  if (mainTable) tables.push({ name: mainTable, type: "main" });

  return tables;
};

const getColumns = (query) => {
  const lowerSQL = query.toLowerCase();

  if (lowerSQL.includes("select *")) return [{ name: "*", table: null }];
  const selectMatch = lowerSQL.match(/select\s+(.*?)\s+from/i);

  if (selectMatch) {
    return selectMatch[1].split(",").map((col) => {
      const cleaned = col.trim().replace(/`/g, "");
      if (cleaned.includes(".")) {
        const [table, column] = cleaned.split(".");
        return { name: column, table };
      }
      return { name: cleaned, table: null };
    });
  }

  const insertMatch = query.match(/insert\s+into\s+\w+\s*\((.*?)\)\s*values/i);
  if (insertMatch) {
    return insertMatch[1].split(",").map((col) => ({
      name: col.trim().replace(/`/g, ""),
      table: null,
    }));
  }

  return [];
};

const getValues = (query) => {
  const valuesMatch = query.match(/values\s*\((.*?)\)/i);
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
  const setMatch = query.match(/set\s+(.+?)(?=\s+where|;|$)/i);
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
  const whereMatch = query.match(
    /\bwhere\b\s+(.+?)(?=\b(order\s+by|group\s+by|having|limit)\b|;|$)/i
  );
  return whereMatch ? whereMatch[1].trim() : "";
};

const sqlParser = (sql) => {
  const trimmedSQL = sql.trim();
  const lowerSQL = trimmedSQL.toLowerCase();

  const tables = getTableNames(trimmedSQL);
  const columns = getColumns(trimmedSQL);
  const whereClause = getWhereConditions(trimmedSQL);
  const values = lowerSQL.includes("insert") ? getValues(trimmedSQL) : null;
  const set = lowerSQL.includes("update") ? getSetClause(trimmedSQL) : null;

  let queryType = "UNKNOWN";
  if (lowerSQL.startsWith("select")) queryType = "SELECT";
  else if (lowerSQL.startsWith("insert")) queryType = "INSERT";
  else if (lowerSQL.startsWith("update")) queryType = "UPDATE";
  else if (lowerSQL.startsWith("delete")) queryType = "DELETE";

  return {
    type: queryType,
    tables,
    columns,
    where: whereClause,
    values,
    set,
    mainTable: tables[0]?.name || "table",
  };
};

export default sqlParser;

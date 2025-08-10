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
  if (query.includes("select *")) return [{ name: "*", table: null }];
  const selectMatch = query.match(/select\s+(.*?)\s+from/i);
  if (!selectMatch) return;

  return selectMatch[1].split(",").map((col) => {
    const cleaned = col.trim().replace(/`/g, "");
    if (cleaned.includes(".")) {
      const [table, column] = cleaned.split(".");
      return { name: column, table };
    }
    return { name: cleaned, table: null };
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
    mainTable: tables[0]?.name || "table",
  };
};

export default sqlParser;

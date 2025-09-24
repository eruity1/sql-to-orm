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

  SQL_PATTERNS.JOIN_PATTERN.lastIndex = 0;

  let match;
  while ((match = SQL_PATTERNS.JOIN_PATTERN.exec(query)) !== null) {
    const [, joinType, tableName, alias, onCondition] = match;
    joins.push({
      type: joinType.trim(),
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
  const lowerQuery = query.toLowerCase();
  const whereIndex = lowerQuery.indexOf("where");
  if (whereIndex === -1) return "";

  let whereClause = query.substring(whereIndex + 5).trim();

  let depth = 0;
  let inQuotes = false;
  let quoteChar = null;
  let i = 0;

  const endKeywords = ["group by", "order by", "having", "limit"];

  while (i < whereClause.length) {
    const char = whereClause[i];

    if ((char === "'" || char === '"') && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      let escapeCount = 0;
      let j = i - 1;
      while (j >= 0 && whereClause[j] === "\\") {
        escapeCount++;
        j--;
      }
      if (escapeCount % 2 === 0) {
        inQuotes = false;
        quoteChar = null;
      }
    }

    if (!inQuotes) {
      if (char === "(") {
        depth++;
      } else if (char === ")") {
        depth--;
      }

      if (depth === 0) {
        const remaining = whereClause.substring(i).toLowerCase();

        for (const keyword of endKeywords) {
          if (
            remaining.match(
              new RegExp(`^\\s+${keyword.replace(" ", "\\s+")}\\b`)
            )
          ) {
            return whereClause.substring(0, i).trim();
          }
        }

        if (remaining.match(/^\\s*;?\\s*$/)) {
          return whereClause.substring(0, i).trim();
        }
      }
    }

    i++;
  }

  return whereClause.trim();
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

const getCTEs = (query) => {
  const ctes = [];
  const lowerQuery = query.toLowerCase();

  if (!lowerQuery.includes("with ")) return ctes;

  const withRegex = /with\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s*\(/gi;
  let match;

  while ((match = withRegex.exec(query)) !== null) {
    const startPos = match.index + match[0].length - 1;
    let parenCount = 1;
    let endPos = startPos;

    for (let i = startPos + 1; i < query.length; i++) {
      if (query[i] === "(") {
        parenCount++;
      } else if (query[i] === ")") {
        parenCount--;
        if (parenCount === 0) {
          endPos = i;
          break;
        }
      }
    }

    if (endPos > startPos) {
      const name = match[1].trim();
      const subquery = query.substring(startPos + 1, endPos).trim();

      ctes.push({
        name: name,
        query: subquery,
      });
    }

    if (withRegex.lastIndex === match.index) {
      withRegex.lastIndex++;
    }
  }

  return ctes;
};

function getWindowFunctions(query) {
  const windowFunctions = [];
  const lowerQuery = query.toLowerCase();

  if (!lowerQuery.includes("over")) return windowFunctions;

  let match;

  while ((match = SQL_PATTERNS.WINDOW_FUNCTION_PATTERN.exec(query)) !== null) {
    windowFunctions.push({
      function: match[1].trim(),
      over: match[2].trim(),
    });

    if (SQL_PATTERNS.WINDOW_FUNCTION_PATTERN.lastIndex === match.index) {
      SQL_PATTERNS.WINDOW_FUNCTION_PATTERN.lastIndex++;
    }
  }

  return windowFunctions;
}

const getSetOperations = (query) => {
  const setOperations = [];
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("union")) {
    SQL_PATTERNS.UNION_PATTERN.lastIndex = 0;
    let match;
    while ((match = SQL_PATTERNS.UNION_PATTERN.exec(query)) !== null) {
      setOperations.push({ type: "UNION", all: match[0].includes("ALL") });
    }
  }

  if (lowerQuery.includes("intersect")) {
    SQL_PATTERNS.INTERSECT_PATTERN.lastIndex = 0;
    let match;
    while ((match = SQL_PATTERNS.INTERSECT_PATTERN.exec(query)) !== null) {
      setOperations.push({ type: "INTERSECT" });
    }
  }

  if (lowerQuery.includes("except") || lowerQuery.includes("minus")) {
    SQL_PATTERNS.EXCEPT_PATTERN.lastIndex = 0;
    let match;
    while ((match = SQL_PATTERNS.EXCEPT_PATTERN.exec(query)) !== null) {
      setOperations.push({ type: "EXCEPT" });
    }
  }

  return setOperations;
};

const getCaseStatements = (query) => {
  const caseStatements = [];
  const lowerQuery = query.toLowerCase();

  if (!lowerQuery.includes("case ")) return caseStatements;

  SQL_PATTERNS.CASE_PATTERN.lastIndex = 0;
  let match;
  while ((match = SQL_PATTERNS.CASE_PATTERN.exec(query)) !== null) {
    caseStatements.push({
      expression: match[0].trim(),
    });
  }

  return caseStatements;
};

const sqlParser = (sql) => {
  const trimmedSQL = sql.toString().trim();
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
  const ctes = getCTEs(trimmedSQL);
  const windowFunctions = getWindowFunctions(trimmedSQL);
  const setOperations = getSetOperations(trimmedSQL);
  const caseStatements = getCaseStatements(trimmedSQL);

  let queryType = "UNKNOWN";
  if (lowerSQL.startsWith("select")) queryType = "SELECT";
  else if (lowerSQL.startsWith("insert")) queryType = "INSERT";
  else if (lowerSQL.startsWith("update")) queryType = "UPDATE";
  else if (lowerSQL.startsWith("delete")) queryType = "DELETE";
  else if (lowerSQL.startsWith("with")) {
    const afterWith = trimmedSQL.slice(lowerSQL.indexOf("with") + 4);
    const match = afterWith.match(/\)\s*(select|insert|update|delete)/i);
    if (match) {
      queryType = match[1].toUpperCase();
    }
  }

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
    ctes,
    windowFunctions,
    setOperations,
    caseStatements,
    mainTable: tables[0]?.name || "table",
  };
};

export default sqlParser;

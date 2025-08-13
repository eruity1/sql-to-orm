import { singularize } from "inflection";

const generateActiveRecordWithJoins = (parsed) => {
  const {
    type,
    columns,
    where,
    mainTable,
    values,
    set,
    groupBy,
    having,
    orderBy,
    limit,
    joins,
  } = parsed;

  const modelName = toModelName(mainTable);

  // If no joins, delegate to regular generation
  if (!joins || joins.length === 0) {
    return generateRegularQuery(parsed);
  }

  switch (type) {
    case "SELECT":
      return generateSelectWithJoins(parsed);
    case "UPDATE":
      return generateUpdateWithJoins(parsed);
    case "DELETE":
      return generateDeleteWithJoins(parsed);
    default:
      return "# Joins not supported for INSERT queries in Active Record";
  }
};

const generateSelectWithJoins = (parsed) => {
  const {
    columns,
    where,
    mainTable,
    groupBy,
    having,
    orderBy,
    limit,
    joins,
    tables,
  } = parsed;

  const modelName = toModelName(mainTable);
  let query = modelName;

  // Add FROM clause if main table has an alias
  const mainTableInfo = tables && tables[0];
  if (mainTableInfo && mainTableInfo.alias) {
    query += `.from("${mainTable} ${mainTableInfo.alias}")`;
  }

  // Add joins
  for (const join of joins) {
    const joinTable = join.table;
    const joinAlias = join.alias;
    const joinType = join.type.toLowerCase().replace(/\s+/g, "_");

    if (joinType === "join" || joinType === "inner_join") {
      // Try to use association if it's a simple case
      if (isSimpleAssociationJoin(join, mainTable) && !mainTableInfo?.alias) {
        const association = guessAssociation(mainTable, joinTable);
        if (association) {
          query += `.joins(:${association})`;
          continue;
        }
      }
    }

    // Use raw SQL for all other cases
    const joinTypeUpper = join.type.toUpperCase();
    query += `.joins("${joinTypeUpper} ${joinTable}${joinAlias ? ` ${joinAlias}` : ""} ON ${join.on}")`;
  }

  // Add WHERE clause with table prefixes
  if (where) {
    const whereClause = parseWhereWithJoins(where, mainTable, joins);
    query += whereClause;
  }

  // Add GROUP BY with table prefixes
  if (groupBy && groupBy.length > 0) {
    const groupCols = groupBy
      .map((col) => {
        if (col.table) {
          return `"${col.table}.${col.name}"`;
        }
        return `"${mainTable}.${col.name}"`;
      })
      .join(", ");
    query += `.group(${groupCols})`;
  }

  // Add HAVING
  if (having) {
    query += `.having("${having}")`;
  }

  // Add ORDER BY with table prefixes
  if (orderBy && orderBy.length > 0) {
    const orderCols = orderBy.map((col) => {
      const columnRef = col.table ? `${col.table}.${col.name}` : col.name;
      return `"${columnRef} ${col.direction}"`;
    });
    query += `.order(${orderCols.join(", ")})`;
  }

  // Add LIMIT/OFFSET
  if (limit) {
    if (limit.offset) {
      query += `.limit(${limit.count}).offset(${limit.offset})`;
    } else {
      query += `.limit(${limit.count})`;
    }
  }

  // Add SELECT with proper table prefixes
  if (columns[0]?.name !== "*") {
    const selectCols = columns
      .map((col) => {
        let columnRef = col.name;

        if (col.table) {
          columnRef = `${col.table}.${col.name}`;
        }

        if (col.alias) {
          return `"${columnRef} AS ${col.alias}"`;
        }
        return `"${columnRef}"`;
      })
      .join(", ");

    query += `.select(${selectCols})`;
  }

  return query;
};

const generateUpdateWithJoins = (parsed) => {
  const { mainTable, joins, where, set, tables } = parsed;
  const modelName = toModelName(mainTable);

  if (!set) {
    return `${modelName}.joins(...).update_all()`;
  }

  let query = modelName;

  // Add FROM clause if main table has an alias
  const mainTableInfo = tables && tables[0];
  if (mainTableInfo && mainTableInfo.alias) {
    query += `.from("${mainTable} ${mainTableInfo.alias}")`;
  }

  // Add joins for UPDATE
  for (const join of joins) {
    const joinTable = join.table;
    const joinAlias = join.alias;
    const joinTypeUpper = join.type.toUpperCase();
    query += `.joins("${joinTypeUpper} ${joinTable}${joinAlias ? ` ${joinAlias}` : ""} ON ${join.on}")`;
  }

  // Add WHERE with joins
  if (where) {
    const whereClause = parseWhereWithJoins(where, mainTable, joins);
    query += whereClause;
  }

  // Add SET clause
  const updateHash = set.reduce((acc, item) => {
    const key = item.name;
    const val = parseValue(item.value);
    acc += `${acc ? ", " : ""}${key}: ${val}`;
    return acc;
  }, "");

  query += `.update_all(${updateHash})`;
  return query;
};

const generateDeleteWithJoins = (parsed) => {
  const { mainTable, joins, where, tables } = parsed;
  const modelName = toModelName(mainTable);

  let query = modelName;

  // Add FROM clause if main table has an alias
  const mainTableInfo = tables && tables[0];
  if (mainTableInfo && mainTableInfo.alias) {
    query += `.from("${mainTable} ${mainTableInfo.alias}")`;
  }

  // Add joins for DELETE
  for (const join of joins) {
    const joinTable = join.table;
    const joinAlias = join.alias;
    const joinTypeUpper = join.type.toUpperCase();
    query += `.joins("${joinTypeUpper} ${joinTable}${joinAlias ? ` ${joinAlias}` : ""} ON ${join.on}")`;
  }

  // Add WHERE with joins
  if (where) {
    const whereClause = parseWhereWithJoins(where, mainTable, joins);
    query += whereClause;
  }

  return query + `.destroy_all`;
};

const isSimpleAssociationJoin = (join, mainTable) => {
  // Check if this looks like a standard Rails association join
  // e.g., "users.id = posts.user_id" could be a belongs_to/has_many relationship
  const simpleJoinRegex = /^(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)$/;
  const match = join.on.match(simpleJoinRegex);

  if (!match) return false;

  const [, table1, col1, table2, col2] = match;

  // Standard Rails convention: main_table.id = other_table.main_table_id
  return (
    (table1 === mainTable &&
      col1 === "id" &&
      col2 === `${singularize(mainTable)}_id`) ||
    (table2 === mainTable &&
      col2 === "id" &&
      col1 === `${singularize(mainTable)}_id`)
  );
};

const parseWhereWithJoins = (where, mainTable, joins) => {
  // Create a map of table aliases
  const tableAliases = new Map();
  tableAliases.set(mainTable, mainTable);

  for (const join of joins) {
    if (join.alias) {
      tableAliases.set(join.alias, join.table);
    }
    tableAliases.set(join.table, join.table);
  }

  // Handle complex WHERE with multiple table references
  const hasComplexOperators =
    /LIKE|NOT LIKE|IN|NOT IN|BETWEEN|IS NULL|IS NOT NULL/i.test(where);

  if (hasComplexOperators) {
    return handleComplexWhereWithJoins(where, mainTable, joins);
  }

  // Simple equality cases
  const simpleOperatorRegex = /(=|!=|>=|<=|>|<)/;
  if (isSimpleEqualityWithJoins(where, simpleOperatorRegex)) {
    return handleSimpleWhereWithJoins(where, mainTable, joins);
  }

  // Fallback to raw SQL
  const placeholders = [];
  const pattern =
    /(\w+(?:\.\w+)?)\s*(=|!=|>=|<=|>|<)\s*([^AND|OR]+?)(\s+(?:AND|OR)\s+|$)/gi;
  let sql = "";

  const matches = [...where.matchAll(pattern)];
  for (const match of matches) {
    const [_, field, operator, val, logical] = match;
    const parsedVal = parseValue(val.trim());
    placeholders.push(parsedVal);
    sql += `${field.trim()} ${operator} ?${logical || ""}`;
  }

  return `.where("${sql}", ${placeholders.join(", ")})`;
};

const handleSimpleWhereWithJoins = (where, mainTable, joins) => {
  const parts = where
    .split(/\s+AND\s+/i)
    .map((cond) => {
      const trimmed = cond.trim();
      const match = trimmed.match(
        /^(\w+(?:\.\w+)?)\s*(=|!=|>=|<=|>|<)\s*(.+)$/
      );
      if (!match) return null;

      const [, field, operator, value] = match;
      return { field: field.trim(), operator, value: parseValue(value.trim()) };
    })
    .filter(Boolean);

  // For joins, we need to use raw SQL for WHERE conditions with table prefixes
  const allConditions = parts
    .map((p) => `${p.field} ${p.operator} ?`)
    .join(" AND ");
  const allParams = parts.map((p) => p.value).join(", ");

  return `.where("${allConditions}", ${allParams})`;
};

const handleComplexWhereWithJoins = (where, mainTable, joins) => {
  const clauses = [];
  let remainingWhere = where;

  // Handle LIKE conditions
  const likeMatches = [
    ...where.matchAll(/(\w+(?:\.\w+)?)\s+(NOT\s+)?LIKE\s+(['"])(.*?)\3/gi),
  ];
  for (const match of likeMatches) {
    const [fullMatch, field, not, _, pattern] = match;
    const method = not ? "where.not" : "where";
    clauses.push(`${method}("${field} LIKE ?", "${pattern}")`);
    remainingWhere = remainingWhere.replace(fullMatch, "");
  }

  // Handle IN conditions
  const inMatches = [
    ...where.matchAll(/(\w+(?:\.\w+)?)\s+(NOT\s+)?IN\s*\(([^)]+)\)/gi),
  ];
  for (const match of inMatches) {
    const [fullMatch, field, not, valuesList] = match;
    const values = valuesList
      .split(",")
      .map((v) => parseValue(v.trim()))
      .join(", ");
    const method = not ? "where.not" : "where";
    clauses.push(`${method}("${field}": [${values}])`);
    remainingWhere = remainingWhere.replace(fullMatch, "");
  }

  // Handle remaining simple conditions
  const remaining = remainingWhere.trim().replace(/^\s*(AND|OR)\s*/i, "");
  if (remaining) {
    const andConditions = remaining.split(/\s+AND\s+/i);
    for (const cond of andConditions) {
      const simpleMatch = cond
        .trim()
        .match(/^(\w+(?:\.\w+)?)\s*(=|!=|>=|<=|>|<)\s*(.+)$/);
      if (!simpleMatch) continue;

      const [, field, operator, value] = simpleMatch;
      const parsedVal = parseValue(value.trim());

      if (operator === "=") {
        clauses.push(`where("${field}": ${parsedVal})`);
      } else if (operator === "!=") {
        clauses.push(`where.not("${field}": ${parsedVal})`);
      } else {
        clauses.push(`where("${field} ${operator} ?", ${parsedVal})`);
      }
    }
  }

  return clauses.length > 0 ? "." + clauses.join(".") : "";
};

// Helper functions
const toModelName = (tableName) => {
  const singular = singularize(tableName);
  return singular
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
};

const parseValue = (val) => {
  if (!val) return "";
  const stripped = val.replace(/^['"]|['"]$/g, "");

  if (stripped.toLowerCase() === "null") {
    return "nil";
  }

  // Handle booleans
  if (stripped.toLowerCase() === "true") {
    return true;
  }
  if (stripped.toLowerCase() === "false") {
    return false;
  }

  // Handle numbers
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(stripped)) {
    return Number(stripped);
  }

  // Handle strings
  return `"${stripped}"`;
};

const isSimpleEqualityWithJoins = (expression, regex) =>
  !/or/i.test(expression) &&
  expression
    .replace(/\([^]+\)/g, "")
    .split(/AND/i)
    .every((str) => regex.test(str.trim()));

const guessAssociation = (mainTable, joinTable) => {
  // Simple heuristics to guess Rails associations
  const mainSingular = singularize(mainTable);
  const joinSingular = singularize(joinTable);

  // Check if join table might be a standard association
  // e.g., users -> posts (posts.user_id), users -> comments, etc.
  const commonAssociations = [
    joinTable.replace(/_$/, ""), // Remove trailing underscore
    singularize(joinTable), // Singularize
    joinTable, // As-is
  ];

  // Return the most likely association name
  return singularize(joinTable);
};

// Fallback to original generator for non-join queries
const generateRegularQuery = (parsed) => {
  const {
    type,
    columns,
    where,
    mainTable,
    values,
    set,
    groupBy,
    having,
    orderBy,
    limit,
  } = parsed;
  const modelName = toModelName(mainTable);

  switch (type) {
    case "SELECT":
      let query = `${modelName}`;
      if (where) {
        const whereClause = parsedWhere(where);
        query += `${whereClause}`;
      }

      if (groupBy && groupBy.length > 0) {
        const groupCols = groupBy.map((col) => `:${col.name}`).join(", ");
        query += `.group(${groupCols})`;
      }

      if (having) {
        query += `.having("${having}")`;
      }

      if (orderBy && orderBy.length > 0) {
        const orderCols = orderBy.map((col) => {
          return `${col.name}: :${col.direction.toLowerCase()}`;
        });
        query += `.order(${orderCols.join(", ")})`;
      }

      if (limit) {
        if (limit.offset) {
          query += `.limit(${limit.count}).offset(${limit.offset})`;
        } else {
          query += `.limit(${limit.count})`;
        }
      }

      if (columns[0]?.name !== "*") {
        const selectCols = columns
          .map((col) => {
            if (col.alias) {
              return `"${col.name} AS ${col.alias}"`;
            }
            if (col.table && col.table !== mainTable) {
              return `"${col.table}.${col.name}"`;
            }
            return `:${col.name}`;
          })
          .join(", ");
        if (selectCols) query += `.select(${selectCols})`;
      }

      return query;

    case "INSERT":
      if (!values || !columns) {
        return `${modelName}.create!()`;
      }
      const attributes = columns.reduce((acc, col, idx) => {
        const key = col.name;
        const value = parseValue(values[idx]);
        acc += `${acc ? ", " : ""}${key}: ${value}`;
        return acc;
      }, "");
      return `${modelName}.create!(${attributes})`;

    case "UPDATE":
      if (!set) {
        return `${modelName}.update_all()`;
      }
      const updateHash = set.reduce((acc, item) => {
        const key = item.column?.name || item.name;
        const val = parseValue(item.value);
        acc += `${acc ? ", " : ""}${key}: ${val}`;
        return acc;
      }, "");
      const whereClause = where ? parsedWhere(where) : "";
      return `${modelName}${whereClause}.update_all(${updateHash})`;

    case "DELETE":
      const deleteWhere = where ? parsedWhere(where) : "";
      return `${modelName}${deleteWhere}.destroy_all`;

    default:
      return "# Could not parse this SQL query";
  }
};

const parsedWhere = (where) => {
  const simpleOperatorRegex = /(=|!=|>=|<=|>|<)/;
  const hasComplexOperators =
    /LIKE|NOT LIKE|IN|NOT IN|BETWEEN|IS NULL|IS NOT NULL/i.test(where);

  if (hasComplexOperators) {
    return handleComplexWhere(where);
  }

  if (isSimpleEqualityWithJoins(where, simpleOperatorRegex)) {
    const parts = where
      .split("AND")
      .map((cond) => {
        const trimmedCond = cond.trim();
        const match = trimmedCond.match(/(.+?)(=|!=|>=|<=|>|<)(.+)/);
        if (!match) return null;

        const [, field, operator, value] = match.map((s) => s.trim());
        return { field, operator, value: parseValue(value) };
      })
      .filter(Boolean);

    const equals = parts.filter((p) => p.operator === "=");
    const notEquals = parts.filter((p) => p.operator === "!=");
    const others = parts.filter((p) => !["=", "!="].includes(p.operator));

    const clauses = [];

    if (equals.length) {
      const hash = equals.map((e) => `${e.field}: ${e.value}`).join(", ");
      clauses.push(`where(${hash})`);
    }

    if (notEquals.length) {
      const hash = notEquals.map((e) => `${e.field}: ${e.value}`).join(", ");
      clauses.push(`where.not(${hash})`);
    }

    if (others.length) {
      const raw = others.map((e) => `${e.field} ${e.operator} ?`).join(" AND ");
      const params = others.map((e) => e.value).join(", ");
      clauses.push(`where("${raw}", ${params})`);
    }

    return "." + clauses.join(".");
  }

  const placeholders = [];
  const pattern = /(.+?)(=|!=|>=|<=|>|<)(.+?)(\s+(?:AND|OR)\s+|$)/gi;
  let sql = "";

  const matches = [...where.matchAll(pattern)];

  for (const match of matches) {
    const [_, field, operator, val, logical] = match;
    const parsedVal = parseValue(val.trim());
    placeholders.push(parsedVal);

    sql += `${field.trim()} ${operator} ?${logical || ""}`;
  }

  return `.where("${sql}", ${placeholders.join(", ")})`;
};

const handleComplexWhere = (where) => {
  const clauses = [];
  let remainingWhere = where;

  const likeMatches = [
    ...where.matchAll(/(\w+(?:\.\w+)?)\s+(NOT\s+)?LIKE\s+(['"])(.*?)\3/gi),
  ];
  for (const match of likeMatches) {
    const [fullMatch, field, not, _, pattern] = match;
    const method = not ? "where.not" : "where";
    clauses.push(`${method}("${field} LIKE ?", "${pattern}")`);
    remainingWhere = removeClause(remainingWhere, fullMatch);
  }

  const inMatches = [
    ...where.matchAll(/(\w+(?:\.\w+)?)\s+(NOT\s+)?IN\s*\(([^)]+)\)/gi),
  ];
  for (const match of inMatches) {
    const [fullMatch, field, not, valuesList] = match;
    const values = valuesList
      .split(",")
      .map((v) => parseValue(v.trim()))
      .join(", ");
    const method = not ? "where.not" : "where";
    clauses.push(`${method}(${field}: [${values}])`);
    remainingWhere = remainingWhere.replace(fullMatch, "");
  }

  const betweenMatches = [
    ...where.matchAll(
      /(\w+(?:\.\w+)?)\s+(NOT\s+)?BETWEEN\s+(.+?)\s+AND\s+(.+?)(?=\s+(?:AND|OR)|$)/gi
    ),
  ];
  for (const match of betweenMatches) {
    const [fullMatch, field, not, start, end] = match;
    const startVal = parseValue(start.trim());
    const endVal = parseValue(end.trim());
    if (not) {
      clauses.push(`where.not(${field}: ${startVal}..${endVal})`);
    } else {
      clauses.push(`where(${field}: ${startVal}..${endVal})`);
    }
    remainingWhere = remainingWhere.replace(fullMatch, "");
  }

  const nullMatches = [
    ...where.matchAll(/(\w+(?:\.\w+)?)\s+IS\s+(NOT\s+)?NULL/gi),
  ];
  for (const match of nullMatches) {
    const [fullMatch, field, not] = match;
    if (not) {
      clauses.push(`where.not(${field}: nil)`);
    } else {
      clauses.push(`where(${field}: nil)`);
    }
    remainingWhere = remainingWhere.replace(fullMatch, "");
  }

  const remaining = remainingWhere.trim().replace(/^\s*(AND|OR)\s*/i, "");
  if (remaining) {
    const andConditions = remaining.split(/\s+AND\s+/i);
    for (const cond of andConditions) {
      const simpleMatch = cond
        .trim()
        .match(/^(\w+(?:\.\w+)?)\s*(=|!=|>=|<=|>|<)\s*(.+)$/);
      if (!simpleMatch) continue;

      const [, field, operator, value] = simpleMatch;
      const parsedVal = parseValue(value.trim());
      if (operator === "=") {
        clauses.push(`where(${field}: ${parsedVal})`);
      } else if (operator === "!=") {
        clauses.push(`where.not(${field}: ${parsedVal})`);
      } else {
        clauses.push(`where("${field} ${operator} ?", ${parsedVal})`);
      }
    }
  }

  return clauses.length > 0 ? "." + clauses.join(".") : "";
};

const removeClause = (where, clause) => {
  const escaped = clause.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `\\s*(AND|OR)?\\s*${escaped}\\s*(AND|OR)?\\s*`,
    "i"
  );
  return where.replace(pattern, " ");
};

export default generateActiveRecordWithJoins;

import { singularize } from "inflection";

const generateActiveRecord = (parsed) => {
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

function toModelName(tableName) {
  const singular = singularize(tableName);
  return singular
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

const isSimpleEquality = (expression, regex) =>
  !/or/i.test(expression) &&
  expression
    .replace(/\([^]+\)/g, "")
    .split(/AND/i)
    .every((str) => regex.test(str.trim()));

const parseValue = (val) => {
  if (!val) return "";
  const stripped = val.replace(/^['"]|['"]$/g, "");

  if (stripped.toLowerCase() === "null") {
    return "nil";
  }

  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(stripped)
    ? Number(stripped)
    : `"${stripped}"`;
};

const parsedWhere = (where) => {
  const simpleOperatorRegex = /(=|!=|>=|<=|>|<)/;
  const hasComplexOperators =
    /LIKE|NOT LIKE|IN|NOT IN|BETWEEN|IS NULL|IS NOT NULL/i.test(where);

  if (hasComplexOperators) {
    return handleComplexWhere(where);
  }

  if (isSimpleEquality(where, simpleOperatorRegex)) {
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

const removeClause = (where, clause) => {
  const escaped = clause.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `\\s*(AND|OR)?\\s*${escaped}\\s*(AND|OR)?\\s*`,
    "i"
  );
  return where.replace(pattern, " ");
};

const handleComplexWhere = (where) => {
  console.log("hello");
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

export default generateActiveRecord;

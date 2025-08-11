const generateActiveRecord = (parsed) => {
  const { type, columns, where, mainTable, values, set } = parsed;
  const modelName = mainTable.charAt(0).toUpperCase() + mainTable.slice(1);

  switch (type) {
    case "SELECT":
      let query = `${modelName}`;
      if (where) {
        const whereClause = parsedWhere(where);
        query += `${whereClause}`;
      }

      if (columns[0]?.name !== "*") {
        const selectCols = columns
          .filter((col) => !col.table || col.table === mainTable)
          .map((col) => `:${col.name}`)
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

const isSimpleEquality = (expresssion, regex) =>
  !/or/i.test(expresssion) &&
  expresssion
    .replace(/\([^]+\)/g, "")
    .split(/AND/i)
    .every((str) => regex.test(str.trim()));

const parseValue = (val) => {
  if (!val) return "";
  const stripped = val.replace(/^['"]|['"]$/g, "");
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(stripped)
    ? Number(stripped)
    : `"${stripped}"`;
};

const parsedWhere = (where) => {
  const operatorRegex = /(=|!=|>=|<=|>|<)/;

  if (isSimpleEquality(where, operatorRegex)) {
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

export default generateActiveRecord;

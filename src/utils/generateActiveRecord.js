const generateActiveRecord = (parsed) => {
  const { type, columns, where, mainTable } = parsed;
  const modelName = mainTable.charAt(0).toUpperCase() + mainTable.slice(1);

  switch (type) {
    case "SELECT":
      let query = `${modelName}`;
      if (where) {
        const whereClause = parseActiveRecordWhere(where);
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
    default:
      return generateBasicActiveRecord(parsed);
  }
};

const generateBasicActiveRecord = (parsed) => {
  const { type, mainTable, where } = parsed;
  const modelName = mainTable.charAt(0).toUpperCase() + mainTable.slice(1);

  switch (type) {
    case "INSERT":
      return `${modelName}.create!()`;
    case "UPDATE":
      const whereClause = where
        ? parseActiveRecordWhere(where)
        : "# your condition";
      return `${modelName}${whereClause}.update_all()`;
    case "DELETE":
      const deleteWhere = where
        ? parseActiveRecordWhere(where)
        : "# your condition";
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
  const stripped = val.replace(/^['"]|['"]$/g, "");
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(stripped)
    ? Number(stripped)
    : `"${stripped}"`;
};

const parseActiveRecordWhere = (where) => {
  const operatorRegex = /(=|!=|>=|<=|>|<)/;

  if (isSimpleEquality(where, operatorRegex)) {
    const parts = where
      .split("AND")
      .map((cond) => {
        const trimmedCond = cond.trim();
        const match = trimmedCond.match(/(.+?)(=|!=|>=|<=|>|<)(.+)/);
        if (!match) return null;

        const [, field, op, value] = match.map((s) => s.trim());
        return { field, operator: op, value: parseValue(value) };
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

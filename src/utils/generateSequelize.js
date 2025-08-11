const generateSequelize = (parsed) => {
  const { type, columns, where, mainTable, values, set } = parsed;
  const modelName = mainTable.charAt(0).toUpperCase() + mainTable.slice(1);

  switch (type) {
    case "SELECT":
      let query = `${modelName}.findAll({`;
      const options = [];

      if (columns[0]?.name !== "*") {
        const selectedColumns = columns
          .filter((col) => !col.table || col.table === mainTable)
          .map((col) => `'${col.name}'`)
          .join(", ");
        if (selectedColumns) options.push(`attributes: [${selectedColumns}]`);
      }
      if (where) {
        const whereObj = parseWhere(where);
        options.push(`where: ${whereObj}`);
      }

      query += options.join(", ") + "})";
      return query;

    case "INSERT":
      if (!values || !columns) {
        return `${modelName}.create({})`;
      }
      const attributes = columns.reduce((acc, col, idx) => {
        const key = col.name;
        const value = parseValue(values[idx]);
        acc += `${acc ? ", " : ""}${key}: ${value}`;
        return acc;
      }, "");
      return `${modelName}.create({ ${attributes} })`;

    case "UPDATE":
      if (!set) {
        return `${modelName}.update({}, { where: {} })`;
      }
      const updateHash = set.reduce((acc, item) => {
        const key = item.column?.name || item.name;
        const val = parseValue(item.value);
        acc += `${acc ? ", " : ""}${key}: ${val}`;
        return acc;
      }, "");
      const whereClause = where ? parseWhere(where) : "{}";
      return `${modelName}.update({ ${updateHash} }, { where: ${whereClause} })`;

    case "DELETE":
      const deleteWhere = where ? parseWhere(where) : "{}";
      return `${modelName}.destroy({ where: ${deleteWhere} })`;

    default:
      return "// Could not parse this SQL query";
  }
};

const isSimpleEquality = (expression, regex) =>
  !/or/i.test(expression) &&
  expression
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

const opMap = {
  "=": "Op.eq",
  "!=": "Op.ne",
  ">=": "Op.gte",
  "<=": "Op.lte",
  ">": "Op.gt",
  "<": "Op.lt",
};

const parseWhere = (where) => {
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

    const clauseStrings = parts.map((p) => {
      let valueStr = p.value;
      if (p.operator === "=") {
        return `${p.field}: ${valueStr}`;
      } else if (p.operator === "!=") {
        return `${p.field}: { [Op.ne]: ${valueStr} }`;
      } else {
        return `${p.field}: { [${opMap[p.operator]}]: ${valueStr} }`;
      }
    });

    return `{ ${clauseStrings.join(", ")} }`;
  }

  const orGroups = where.split(/\s+OR\s+/i).map((group) => group.trim());
  let sql = [];

  for (const group of orGroups) {
    const andConditions = group.split(/\s+AND\s+/i).map((cond) => cond.trim());
    const andClauses = [];

    for (const cond of andConditions) {
      const match = cond.match(/(.+?)(=|!=|>=|<=|>|<)(.+)/);
      if (!match) continue;

      const [, field, operator, value] = match.map((s) => s.trim());
      const parsedValue = parseValue(value);
      if (operator === "=") {
        andClauses.push(`{ ${field}: ${parsedValue} }`);
      } else {
        andClauses.push(
          `{ ${field}: { [${opMap[operator]}]: ${parsedValue} } }`
        );
      }
    }

    if (andClauses.length === 1) {
      sql.push(andClauses[0]);
    } else if (andClauses.length > 1) {
      sql.push(`{ [Op.and]: [${andClauses.join(", ")}] }`);
    }
  }

  if (sql.length === 1) {
    return sql[0];
  } else if (sql.length > 1) {
    return `{ [Op.or]: [${sql.join(", ")}] }`;
  }

  return "{}";
};

export default generateSequelize;

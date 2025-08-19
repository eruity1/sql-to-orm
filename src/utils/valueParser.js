import { SQL_PATTERNS } from "../constants";

export class ValueParser {
  static parse(val) {
    if (!val) return "";

    const stripped = val.replace(SQL_PATTERNS.VALUE_CLEANUP, "");

    if (stripped.toLowerCase() === "null") return "nil";
    if (stripped.toLowerCase() === "true") return true;
    if (stripped.toLowerCase() === "false") return false;
    if (SQL_PATTERNS.NUMBER.test(stripped)) return Number(stripped);
    if (SQL_PATTERNS.DATE_PATTERN.test(stripped)) {
      return `"${stripped}"`;
    }

    return `"${stripped}"`;
  }
}

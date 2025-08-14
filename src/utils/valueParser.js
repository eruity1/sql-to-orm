import { SQL_PATTERNS } from "../constants";

export class ValueParser {
  static parse(val) {
    if (!val) return "";

    const stripped = val.replace(SQL_PATTERNS.VALUE_CLEANUP, "");

    if (stripped.toLowerCase() === "null") return "nil"; // need to update for other languages
    if (stripped.toLowerCase() === "true") return true;
    if (stripped.toLowerCase() === "false") return false;
    if (SQL_PATTERNS.NUMBER.test(stripped)) return Number(stripped);

    return `"${stripped}"`;
  }
}

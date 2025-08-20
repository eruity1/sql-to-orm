import { QUERY_TYPES } from "../constants";

export class BaseGenerator {
  generateQuery(parsed) {
    const { type } = parsed;

    switch (type) {
      case QUERY_TYPES.SELECT:
        return this.generateSelect(parsed);
      case QUERY_TYPES.INSERT:
        return this.generateInsert(parsed);
      case QUERY_TYPES.UPDATE:
        return this.generateUpdate(parsed);
      case QUERY_TYPES.DELETE:
        return this.generateDelete(parsed);
      default:
        return this.getUnsupportedMessage();
    }
  }

  generateSelect() {
    throw new Error("Must implement generateSelect");
  }
  generateInsert() {
    throw new Error("Must implement generateInsert");
  }
  generateUpdate() {
    throw new Error("Must implement generateUpdate");
  }
  generateDelete() {
    throw new Error("Must implement generateDelete");
  }
  getUnsupportedMessage() {
    return "# Query type not supported";
  }
}

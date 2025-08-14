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

  generateSelect(_) {
    throw new Error("Must implement generateSelect");
  }
  generateInsert(_) {
    throw new Error("Must implement generateInsert");
  }
  generateUpdate(_) {
    throw new Error("Must implement generateUpdate");
  }
  generateDelete(_) {
    throw new Error("Must implement generateDelete");
  }
  getUnsupportedMessage() {
    return "# Query type not supported";
  }
}

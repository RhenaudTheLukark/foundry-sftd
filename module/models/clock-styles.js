const { ObjectField } = foundry.data.fields;

export class ClockStylesData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return { contents: new ObjectField({}) };
  }

  /**
   * Migrate source data from some prior format into a new specification.
   * The source parameter is either original data retrieved from disk or provided by an update operation.
   * @inheritDoc
   */
  static migrateData(source) {
    return super.migrateData(source);
  }
}

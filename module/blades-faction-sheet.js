
import { BladesHelpers } from "./blades-helpers.js";
import { BladesSheet } from "./blades-sheet.js";

/**
 * @extends {BladesSheet}
 */
export class BladesFactionSheet extends BladesSheet {

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
  	  classes: ["songs-for-the-dusk", "sheet", "actor", "faction"],
  	  template: "systems/songs-for-the-dusk/templates/actors/faction-sheet.html",
      width: 500,
      height: 'auto',
      tabs: [{navSelector: ".tabs", contentSelector: ".tab-content"}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    const superData = super.getData(options);
    const sheetData = superData.data;
    sheetData.owner = superData.owner;
    sheetData.editable = superData.editable;
    sheetData.isGM = game.user.isGM;

    sheetData.system.members = BladesHelpers.fetchSimpleData(sheetData.system.members, [], BladesHelpers._crewMemberCompareFunc);
    sheetData.system.members = sheetData.system.members.map((m) => { return { data: m, class: BladesHelpers.getOwnedItem(m, m.system.class) }; });

    // Fetch relationships data and direct relationships
    [sheetData.system.relationships, sheetData.system.direct_relationships] = BladesHelpers.fetchFullAndRelativeRelationshipsData(this.actor, sheetData.system.relationships);
    sheetData.onlyDirectRelationships = Object.keys(sheetData.system.relationships).length == Object.keys(sheetData.system.direct_relationships).length;

    sheetData.defaultClockThemeColor = game.settings.get('songs-for-the-dusk', 'DefaultClockThemeColor');

    return sheetData;
  }

    /** @override */
  async _onDropItem(event, droppedItem) {
    await super._onDropItem(event, droppedItem);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this faction. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedItem);
  }

  /** @override */
  async _onDropActor(event, droppedActor) {
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this faction. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedActor);
  }

  /** @override */
  async handleDrop(event, droppedEntity) {
    let droppedEntityFull = BladesHelpers.resolveActor(droppedEntity.uuid);
    await this.handleAddedObjects([droppedEntityFull]);
  }

  async handleAddedObjects(droppedEntitiesFull) {
    let currentTab = this._tabs[0].active;
    for (let droppedEntityFull of droppedEntitiesFull) {
      if (!droppedEntityFull || droppedEntityFull.uuid == this.actor.uuid)
        continue;

      switch (droppedEntityFull.type) {
        case 'crew':
        case 'faction':
          await BladesHelpers.addRelationship(this.actor, droppedEntityFull);
          break;
        case 'npc':
          await BladesHelpers.addFactionNPC(this.actor, droppedEntityFull, true);
          break;
        default:
          break;
      }
    }
  }

  /* -------------------------------------------- */

  /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add Clock
    html.find('.add-clock').click(async _ => {
      let clocks = this.actor.system.clocks;
      clocks[Object.keys(clocks).length] = {
        title: '',
        description: '',
        max: 4,
        value: 0
      }
      await BladesHelpers.tryUpdate(this.actor, {system: {'==clocks': clocks}});
    });

    // Delete Clock
    html.find('.delete-clock').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentClockId = element.data("clockId");
      let clocksEntries = Object.entries(this.actor.system.clocks);
      clocksEntries.splice(currentClockId, 1);
      for (let id in clocksEntries)
        clocksEntries[id][0] = String(id);
      await BladesHelpers.tryUpdate(this.actor, {system: {'==clocks': Object.fromEntries(clocksEntries)}});
    });
	}
}

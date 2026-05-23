import { BladesSheet } from "./blades-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { BladesHelpers } from "./blades-helpers.js";

/**
 * @extends {BladesSheet}
 */
export class BladesCrewSheet extends BladesSheet {

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
  	  classes: ["songs-for-the-dusk", "sheet", "actor", "crew"],
  	  template: "systems/songs-for-the-dusk/templates/crew-sheet.html",
      width: 940,
      height: 940,
      tabs: [{navSelector: ".tabs", contentSelector: ".tab-content", initial: "upgrades"}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    const superData = super.getData( options );
    const sheetData = superData.data;
    sheetData.owner = superData.owner;
    sheetData.editable = superData.editable;
    sheetData.isGM = game.user.isGM;

    sheetData.system.members = BladesHelpers.fetchSimpleData(sheetData.system.members, [], BladesHelpers._crewMemberCompareFunc);
    sheetData.system.members = sheetData.system.members.map((m) => { return { data: m, class: BladesHelpers.getOwnedItem(m, m.system.class) }; });

    // Prepare active effects
    sheetData.effects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);

    sheetData.defaultClockStyle = game.settings.get('songs-for-the-dusk', 'DefaultClockStyle');

    return sheetData;
  }

  /** @override */
  async _onDropItem(event, droppedItem) {
    await super._onDropItem(event, droppedItem);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this squad. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedItem);
  }

  /** @override */
  async _onDropActor(event, droppedActor) {
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this squad. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
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
          //await BladesHelpers.addRelationship(this.actor, droppedEntityFull);
          break;
        case 'strider':
          await BladesHelpers.addCrewStrider(this.actor, droppedEntityFull, true);
          break;
        case 'npc':
          //await BladesHelpers.addSquadNPC(this.actor, droppedEntityFull, true);
          break;
        case 'crew_type':
          await this.addItemAsObjectAndStoreReference(droppedEntityFull, 'system.type');
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

    // Add Crew Type
    html.find(".crew-class").click(this.onItemAddClick.bind(this));

    // Add a new Cohort
    html.find('.add-item').click(async ev => {
      await BladesHelpers._addOwnedItem(ev, this.actor);
    });

    // Toggle Turf
    html.find('.turf-select').click( async ev => {
      const element = $(ev.currentTarget).parents(".item");

      let item_id = element.data("itemId")
      let turf_id = $(ev.currentTarget).data("turfId");
      let turf_current_status = $(ev.currentTarget).data("turfStatus");
      let turf_checkbox_name = 'system.turfs.' + turf_id + '.value';

      await this.actor.updateEmbeddedDocuments('Item', [{
        _id: item_id,
        [turf_checkbox_name]: !turf_current_status}]);
      this.render(false);
    });

    // Cohort Block Harm handler
    html.find('.cohort-block-harm input[type="radio"]').change( async ev => {
      const element = $(ev.currentTarget).parents(".item");

      let item_id = element.data("itemId")
      let harm_id = $(ev.currentTarget).val();

      await this.actor.updateEmbeddedDocuments('Item', [{
        _id: item_id,
        "system.harm": [harm_id]}]);
      this.render(false);
    });
  }
}

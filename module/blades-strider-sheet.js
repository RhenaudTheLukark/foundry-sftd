import {BladesSheet} from "./blades-sheet.js";
import {BladesActiveEffect} from "./blades-active-effect.js";
import {BladesHelpers} from "./blades-helpers.js";
import { enrichHTML } from "./compat.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {BladesSheet}
 */
export class BladesStriderSheet extends BladesSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["songs-for-the-dusk", "sheet", "actor", "strider"],
      template: "systems/songs-for-the-dusk/templates/actors/strider-sheet.html",
      width: 790,
      height: 890,
      tabs: [{navSelector: ".tabs", contentSelector: ".tab-content", initial: "community"}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const superData = super.getData(options);
    const sheetData = superData.data;
    sheetData.owner = superData.owner;
    sheetData.editable = superData.editable;
    sheetData.isGM = game.user.isGM;

    // Prepare active effects
    sheetData.effects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);

    sheetData.system.crew = BladesHelpers.resolveActor(sheetData.system.crew, { name: 'Unknown Crew' });

    sheetData.system.class = BladesHelpers.getOwnedItem(this.actor, sheetData.system.class);

    // Calculate Load
    let loadout = 0;
    sheetData.items.forEach(i => {
      loadout += (i.type === "item") ? parseInt(i.system.load) : 0
    });
    loadout = Math.max(Math.min(loadout, 11), 0);
    sheetData.system.loadout = loadout;

    // Encumbrance Levels
    let load_level;
    let mule_level;
    if (game.settings.get('songs-for-the-dusk', 'DeepCutLoad')) {
      load_level = ["SFTD.Discreet", "SFTD.Discreet", "SFTD.Discreet", "SFTD.Discreet", "SFTD.Discreet", "SFTD.Conspicuous", "SFTD.Conspicuous", "SFTD.Encumbered",
        "SFTD.Encumbered", "SFTD.Encumbered", "SFTD.OverMax", "SFTD.OverMax"];
      mule_level = ["SFTD.Discreet", "SFTD.Discreet", "SFTD.Discreet", "SFTD.Discreet", "SFTD.Discreet", "SFTD.Discreet", "SFTD.Discreet", "SFTD.Conspicuous",
        "SFTD.Conspicuous", "SFTD.Encumbered", "SFTD.Encumbered", "SFTD.OverMax"];
    } else {
      load_level = ["SFTD.Light", "SFTD.Light", "SFTD.Light", "SFTD.Light", "SFTD.Normal", "SFTD.Normal", "SFTD.Heavy", "SFTD.Encumbered",
        "SFTD.Encumbered", "SFTD.Encumbered", "SFTD.OverMax", "SFTD.OverMax"];
      mule_level = ["SFTD.Light", "SFTD.Light", "SFTD.Light", "SFTD.Light", "SFTD.Light", "SFTD.Light", "SFTD.Normal", "SFTD.Normal",
        "SFTD.Heavy", "SFTD.Encumbered", "SFTD.OverMax", "SFTD.OverMax"];
    }

    //look for Mule ability
    // @todo - fix translation.
    let mule_present = 0;
    sheetData.items.forEach(i => {
      if (i.type === "ability" && i.name === "(C) Mule") {
        mule_present = 1;
      }
    });
    sheetData.system.load_level = mule_present ? mule_level[loadout] : load_level[loadout];

    if (game.settings.get('songs-for-the-dusk', 'DeepCutLoad')) {
      sheetData.system.load_levels = {"SFTD.Discreet": "SFTD.Discreet", "SFTD.Conspicuous": "SFTD.Conspicuous"};
    } else {
      sheetData.system.load_levels = {
        "SFTD.Light": "SFTD.Light",
        "SFTD.Normal": "SFTD.Normal",
        "SFTD.Heavy": "SFTD.Heavy"
      };
    }

    sheetData.system.description = await enrichHTML(sheetData.system.description, {
      secrets: sheetData.owner,
      async: true
    });

    // catch unmigrated actor data
    sheetData.system.attributes = this.actor.getComputedAttributes();

    //check for additional stress from crew sources
    sheetData.system.stress.max = this.actor.getMaxStress();
    sheetData.system.scars.value = Object.values(sheetData.system.scars.values).filter(s => s != '').length;

    sheetData.defaultClockThemeColor = game.settings.get('songs-for-the-dusk', 'DefaultClockThemeColor');

    return sheetData;
  }

  /** @override */
  async _onDropItem(event, droppedItem) {
    await super._onDropItem(event, droppedItem);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedItem);
  }

  /** @override */
  async _onDropActor(event, droppedActor) {
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
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
    for (let droppedEntityFull of droppedEntitiesFull) {
      if (!droppedEntityFull || droppedEntityFull.uuid == this.actor.uuid)
        continue;

      switch (droppedEntityFull.type) {
        case 'crew':
          await BladesHelpers.addCrewStrider(droppedEntityFull, this.actor, false);
          break;
        case 'region':
          //await BladesHelpers.addCharacterRegion(this.actor, droppedEntityFull, true);
          break;
        case 'strider':
        case 'npc':
          //await BladesHelpers.addCharacterConnection(this.actor, droppedEntityFull, true);
          break;
        case 'class':
          await this.addItemAsObjectAndStoreReference(droppedEntityFull, 'system.class');
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

    html.find('.melody-toggle').click(async ev => {
      await BladesHelpers.tryUpdate(this.actor, {'system.melody': !this.actor.system.melody});
    });

    // Delete Strider's Class
    html.find('.delete-class').click(async ev => {
      let element = $(ev.currentTarget).closest('.item');
      let item = this.actor.items.get(element.data('itemId'));
      if (element.parent().hasClass('item-with-container'))
        element = element.parent();
      element.slideUp(200, async () => {
        await this.actor.removeItem(item);
        await BladesHelpers.tryUpdate(this.actor, {system: {'==class': null}});
      });
    });

    // Remove Crew from Strider sheet
    html.find('.delete-crew').click(async ev => {
      await BladesHelpers.removeCrewStrider(this.actor);
    });

    // Delete Connection
    html.find('.delete-connection').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentConnectionId = element.data('connectionId');
      let connectionsEntries = Object.entries(this.actor.system.connections);
      connectionsEntries.splice(currentConnectionId, 1);
      for (let id in connectionsEntries)
        connectionsEntries[id][0] = String(id);
      await BladesHelpers.tryUpdate(this.actor, {system: {'==connections': Object.fromEntries(connectionsEntries)}});
    });
  }
}

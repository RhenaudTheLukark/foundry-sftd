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

    // Compute invested caches
    let invested = 0;
    for (let project of Object.values(sheetData.system.projects))
      if (Number(project.clock.value) < Number(project.clock.max))
        invested += Number(project.invested_caches);
    sheetData.system.cache.invested = invested;

    sheetData.clockSizeDropdown = {
      '4': '4',
      '6': '6',
      '8': '8',
      '10': '10',
      '12': '12',
    };

    sheetData.investedCachesDropdown = Object.fromEntries(Array(9).fill().map((_, i) => [String(i), String(i)]));

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

  investedCacheClick(ev) {
    ev.preventDefault();

    let label = ev.currentTarget;
    let element = ev.currentTarget;
    if (label.tagName.toLowerCase() == 'label')
      element = element.previousElementSibling;

    if (label.classList.contains('enabled') || (ev.type == 'contextmenu')) {
      // Find the next lowest-value input with the same name
      let name = element.name;
      if (!name) name = element.dataset.name;
      let value = element.value;
      if (!value) value = element.dataset.value;
      value = parseInt(value);
      value = value + (value < 0 ? 1 : -1);
      element = element.parentElement.querySelector(`[name='${name}'][value='${value}']`);
    }
    const investedCaches = element.closest('.cache').querySelectorAll('input.invested');
    if (element.id == investedCaches[investedCaches.length - 1].id)
      BladesHelpers.onRadioToggle(ev);
    else
      ui.notifications.warn(game.i18n.localize('SFTD.log.warn.TriedRemovingInvestedCache'));
  }

  /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add a new Cohort
    html.find('label.invested').click(this.investedCacheClick);
    html.find('label.invested').contextmenu(this.investedCacheClick);

    // Add Crew Type
    html.find('.crew-class').click(this.onItemAddClick.bind(this));

    // Add a new Cohort
    html.find('.add-item').click(async ev => {
      await BladesHelpers._addOwnedItem(ev, this.actor);
    });

    // Add Project
    html.find('.add-project').click(async _ => {
      let projects = this.actor.system.projects;
      projects[Object.keys(projects).length] = {
        title: '',
        clock: {
          value: 0,
          max: 4,
          min: 0,
          invested_caches: 0
        },
        description: ''
      }
      await BladesHelpers.tryUpdate(this.actor, {system: {'==projects': projects}});
    });

    // Delete Project
    html.find('.delete-project').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentProjectId = element.data('projectId');
      let projectsEntries = Object.entries(this.actor.system.projects);
      projectsEntries.splice(currentProjectId, 1);
      for (let id in projectsEntries)
        projectsEntries[id][0] = String(id);
      await BladesHelpers.tryUpdate(this.actor, {system: {'==projects': Object.fromEntries(projectsEntries)}});
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

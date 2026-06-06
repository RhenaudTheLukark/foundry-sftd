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
  	  template: "systems/songs-for-the-dusk/templates/actors/crew-sheet.html",
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

    // Fetch relationships data and direct relationships
    [sheetData.system.relationships, sheetData.system.direct_relationships] = BladesHelpers.fetchFullAndRelativeRelationshipsData(this.actor, sheetData.system.relationships);
    sheetData.onlyDirectRelationships = Object.keys(sheetData.system.relationships).length == Object.keys(sheetData.system.direct_relationships).length;

    // Prepare active effects
    sheetData.effects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);

    // Compute invested caches
    let invested = 0;
    for (let project of Object.values(sheetData.system.projects))
      if (Number(project.clock.value) < Number(project.clock.max))
        invested += Number(project.invested_caches);
    sheetData.system.cache.invested = invested;

    sheetData.investedCachesDropdown = Object.fromEntries(Array(9).fill().map((_, i) => [String(i), String(i)]));

    sheetData.defaultClockThemeColor = game.settings.get('songs-for-the-dusk', 'DefaultClockThemeColor');

    return sheetData;
  }

  /** @override */
  async _onDropItem(event, droppedItem) {
    await super._onDropItem(event, droppedItem);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this crew. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedItem);
  }

  /** @override */
  async _onDropActor(event, droppedActor) {
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this crew. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
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
        case 'strider':
          await BladesHelpers.addCrewStrider(this.actor, droppedEntityFull, true);
          break;
        case 'npc':
          await BladesHelpers.addFactionNPC(this.actor, droppedEntityFull, true);
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

  async updateSpecialist(ev) {
    ev.preventDefault();

    let label = ev.currentTarget;
    let element = ev.currentTarget;
    if (label.tagName.toLowerCase() == 'label')
      element = element.previousElementSibling;

    let value = Number(element.value);
    if (!value) value = Number(element.dataset.value);
    if (label.classList.contains('enabled') || (ev.type == 'contextmenu'))
      value --;

    if (value < this.actor.system.cache.invested)
      return;
    let newTier = this.actor.getTier(value);
    for (let specialist of this.actor.items.filter(i => i.type == 'specialist'))
      await specialist.updateSpecialistQuality(newTier);
  }

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
      element = element.parentElement.querySelector(`[name='${name}'][value='${value}'], [name="${name}"][value="${value}"], [data-name='${name}'][data-value='${value}'], [data-name="${name}"][data-value="${value}"]`);
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

    html.find('label.invested').click(this.investedCacheClick);
    html.find('label.invested').contextmenu(this.investedCacheClick);

    html.find('.cache label').click(async ev => {
      this.updateSpecialist(ev);
    });
    html.find('.cache label').contextmenu(async ev => {
      this.updateSpecialist(ev);
    });

    // Add Crew Type
    html.find('.crew-class').click(this.onItemAddClick.bind(this));

    // Add a new Item
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
          theme_color: null,
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

    html.find('.delete-member').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let memberUuid = element.data('itemId');
      let memberFull = BladesHelpers.resolveActor(memberUuid);
      if (!memberFull) return;
      if (memberFull.type == 'strider')
        await BladesHelpers.removeCrewStrider(memberFull);
      else if (memberFull.type == 'npc')
        await BladesHelpers.removeFactionNPC(memberFull);
    });

    // Specialist Block Harm handler
    html.find('.specialist-block-harm input[type="radio"]').change( async ev => {
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

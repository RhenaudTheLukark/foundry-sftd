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
    sheetData.system.cache.invested = this.getInvestedCaches();

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

  /* -------------------------------------------- */

  getInvestedCaches() {
    let invested = 0;
    for (let foundation of Object.values(this.actor.items.filter(i => i.type == 'foundation')))
      invested += foundation.system.cache_cost;
    for (let project of Object.values(this.actor.system.projects))
      if (Number(project.clock.value) < Number(project.clock.max))
        invested += Number(project.invested_caches);
    return invested;
  }

  /* -------------------------------------------- */

  async onFoundationAddClick(event) {
    event.preventDefault();
    let displayFoundation = function(item, availableCaches, dialogId) {
      const isTooExpensive = availableCaches < item.system.cache_cost;
      let html = `<input id="${dialogId}-select-item-${item._id}" name="select_items" type="checkbox" data-cache-cost="${item.system.cache_cost}" value="${item._id}"${isTooExpensive ? ' disabled' : ''}>`;
      html += `<label class="entry${isTooExpensive ? ' too-expensive' : ''}" for="${dialogId}-select-item-${item._id}" data-cache-cost="${item.system.cache_cost}">`;
      html += `${game.i18n.localize(item.name)} (${item.system.cache_cost})<i class="fas fa-question-circle" data-tooltip="${game.i18n.localize(item.system.description)}"></i>`;
      html += `</label>`;
      return html;
    }
    let displayProsperity = function(level, items, availableCaches, dialogId) {
      const prosperityTitle = level != 0 ? `${game.i18n.localize('SFTD.ProsperityLevel')} ${level}` : game.i18n.localize('SFTD.StartingFoundations');
      let html = '<div class="prosperity-container flex-vertical">';
      html += `<label class="prosperity-title">${prosperityTitle}</label>`;
      for (const item of Object.values(items.filter(i => i.system.prosperity_level == level)))
        html += displayFoundation(item, availableCaches, dialogId);
      html += '</div>';
      return html;
    }

    let element = event.currentTarget;
    let availableCaches = this.actor.system.cache.value - this.getInvestedCaches();

    let items = await BladesHelpers.getAllObjectDocumentsByType('foundation', [], game);
    if (items.length == 0) {
      ui.notifications.warn(game.i18n.localize('SFTD.log.warn.NothingToAdd'));
      return;
    }
    let prosperityOccurrences = items.map(i => i.system.prosperity_level).reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {});

    let dialogId = foundry.applications.api.ApplicationV2._appId + 1;
    let html = `<label class="available-caches" data-caches="${availableCaches}">${game.i18n.localize('SFTD.AvailableCaches')}: ${availableCaches}<span></span></label>`;
    html += `<input id="${dialogId}-search-bar" type="text" data-cache-cost="${availableCaches}" value="" placeholder="${game.i18n.format('SFTD.SearchBar', { obj: game.i18n.localize(`TYPES.Item.foundation`) })}" autofocus>`;
    html += `<div class="objects-to-add flex-vertical">`;
    for (const prosperityLevel of Object.keys(prosperityOccurrences)) {
      if (prosperityLevel == 0) continue;
      html += displayProsperity(prosperityLevel, items, availableCaches, dialogId);
    }
    html += displayProsperity(0, items, availableCaches, dialogId);
    html += `</div>`;

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('SFTD.Add')} ${game.i18n.localize(`TYPES.Item.foundation`)}` },
      content: html,
      classes: ['add-foundation-popup'],
      buttons: [
        {
          icon: 'fas fa-clipboard',
          label: game.i18n.localize('SFTD.AddAsProject'),
          action: 'addAsProject',
          default: true
        },
        {
          icon: 'fas fa-check',
          label: game.i18n.localize('SFTD.Add'),
          action: 'add'
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('SFTD.Cancel'),
          action: 'cancel'
        }
      ],
      submit: async (result, dialog) => {
        if (result == 'cancel')
          return;
        const itemsToAddElements = $(dialog.element).find('.objects-to-add');
        if (result == 'add')
          await this.addItemsToSheet('foundation', itemsToAddElements, null, true, null);
        if (result == 'addAsProject') {
          let items = await BladesHelpers.getAllObjectDocumentsByType('foundation', [], game);
          let itemsToAdd = [];
          itemsToAddElements.find('input:checked').each(function() {
            let item = items.find(e => e._id === $(this).val());
            if (item)
              itemsToAdd.push(items.find(e => e._id === $(this).val()));
          });
          for (let itemToAdd of itemsToAdd)
            await BladesHelpers.addProject(dialog.actor, itemToAdd);
        }
      }
    });

    dialog.actor = this.actor;
    dialog._onFirstRender = this.dialogOnFirstRender;
    await dialog.render(true);

    for (const element of dialog.element.querySelector('.objects-to-add').querySelectorAll('input')) {
      element.addEventListener('click', async (ev) => {
        const element = ev.currentTarget;
        const objectsToAddElement = element.closest('.objects-to-add');
        const objectsAdded = objectsToAddElement.querySelectorAll('input:checked'); 
        let availableCaches = Number(objectsToAddElement.parentElement.querySelector('.available-caches').dataset.caches);
        const originalAvailableCaches = availableCaches;
        for (const objectAdded of objectsAdded)
          availableCaches -= Number(objectAdded.dataset.cacheCost);

        let needCacheDisplay = originalAvailableCaches != availableCaches;
        let availableCachesSpanElement = objectsToAddElement.parentElement.querySelector('.available-caches span');
        availableCachesSpanElement.innerHTML = needCacheDisplay ? ` => ${availableCaches}` : '';

        for (const input of objectsToAddElement.querySelectorAll('input')) {
          const label = input.nextElementSibling;
          const tooExpensive = Number(label.dataset.cacheCost) > availableCaches && !input.checked;
          const oldTooExpensive = label.classList.contains('too-expensive');
          input.disabled = tooExpensive;
          if (tooExpensive && !oldTooExpensive)
            label.classList.add('too-expensive');
          if (!tooExpensive && oldTooExpensive)
            label.classList.remove('too-expensive');
        }
      });
    }
  }

  /* -------------------------------------------- */

  /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html.find('.foundation-add-popup').click(this.onFoundationAddClick.bind(this));

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

    // Delete Signature Gear
    html.find('.delete-signature-gear').click(async ev => {
      await BladesHelpers.tryUpdate(this.actor, {'system.signature_gear': null});
    });

    // Add a new Item
    html.find('.add-item').click(async ev => {
      await BladesHelpers._addOwnedItem(ev, this.actor);
    });

    // Add Project
    html.find('.add-project').click(async _ => {
      await BladesHelpers.addProject(this.actor);
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

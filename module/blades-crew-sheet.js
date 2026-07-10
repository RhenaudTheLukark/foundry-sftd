import { BladesSheet } from "./blades-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { BladesHelpers } from "./blades-helpers.js";
import { bladesRoll, buildRollPopup, resolveRollModifierArray, resolveConditionalModifiers,
  checkDowntimeRules, dialogOnFirstRender, dialogOnRender, refreshModifiers, postRollProcessing,
  pruneInvalidConditionalRollModifiers, keepValidModifiersFromOther } from './blades-roll.js';
import { SFTDChatMessage } from "./messages/sftd-chat-message.js";

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

  /**
   * Call a popup for creating a group action.
   */
  async createGroupActionPopup() {
    let attributes = '';
    for (let attribute of BladesHelpers.getAllActions())
      attributes += `<option value="${attribute}">${game.i18n.localize(BladesHelpers.getAttributeLabel(attribute))}</option>`
    let members = '';
    for (let member of Object.values(this.actor.system.members)) {
      let memberFull = BladesHelpers.resolveActor(member.uuid);
      if (memberFull && memberFull.type == 'strider')
        members += `<option value="${member.uuid}">${memberFull.name}</option>`
    }

    let contents = `
      <h2>${game.i18n.localize('SFTD.CreateGroupAction')}</h2>
      <form>
        <div class="form-group">
          <label>${game.i18n.localize('SFTD.Action')}:</label>
          <select id="attribute" name="attribute">
            ${attributes}
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('SFTD.Position')}:</label>
          <select id="pos" name="pos">
            <option value="controlled">${game.i18n.localize('SFTD.PositionControlled')}</option>
            <option value="risky" selected>${game.i18n.localize('SFTD.PositionRisky')}</option>
            <option value="desperate">${game.i18n.localize('SFTD.PositionDesperate')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('SFTD.Impact')}:</label>
          <select id="impact" name="impact">
            <option value="weak">${game.i18n.localize('SFTD.ImpactWeak')}</option>
            <option value="normal" selected>${game.i18n.localize('SFTD.ImpactNormal')}</option>
            <option value="strong">${game.i18n.localize('SFTD.ImpactStrong')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('SFTD.Leader')}:</label>
          <select id="leader" name="leader">
            ${members}
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('SFTD.Notes')}:</label>
          <input id="note" name="note" type="text" value="">
        </div>
      </form>`;

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('SFTD.CreateGroupAction')}` },
      content: contents,
      buttons: [
        {
          icon: 'fas fa-people-group',
          label: game.i18n.localize('SFTD.CreateGroupAction'),
          action: 'create-group-action',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'create-group-action') return;

        let html = $(dialog.element);
        let attribute = html.find('[name="attribute"]')[0].value;
        let position = html.find('[name="pos"]')[0].value;
        let impact = html.find('[name="impact"]')[0].value;
        let leaderFull = BladesHelpers.resolveActor(html.find('[name="leader"]')[0].value);
        let note = html.find('[name="note"]')[0].value;
        let speaker = {
          actor: this.actor._id,
          alias: this.actor.name,
          scene: null,
          token: this.actor.prototypeToken._id
        };
        await this.actor.createGroupAction(attribute, position, true, impact, true, leaderFull, note);
        let messageData = {
          speaker: speaker,
          groupActionCrew: this.actor.uuid,
          content: await foundry.applications.handlebars.renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/group-action-begin.html', { attribute_label: BladesHelpers.getAttributeLabel(attribute), position: this.actor.system.group_action.position, impact: this.actor.system.group_action.impact, leader: leaderFull, crew: this.actor, note: note })
        }
        SFTDChatMessage.create(messageData);
      }
    });
    dialog.render(true);
  }

  /* -------------------------------------------- */

  async onFoundationAddClick(event) {
    event.preventDefault();
    let displayFoundation = function(item, availableCaches, dialogId, isFree) {
      const cacheCost = (isFree ? 0 : item.system.cache_cost);
      const isTooExpensive = availableCaches < cacheCost;
      let html = `<input id="${dialogId}-select-item-${item._id}" name="select_items" type="checkbox" data-cache-cost="${cacheCost}" value="${item._id}"${isTooExpensive ? ' disabled' : ''}>`;
      html += `<label class="entry${isTooExpensive ? ' too-expensive' : ''}" for="${dialogId}-select-item-${item._id}" data-cache-cost="${cacheCost}">`;
      html += `${game.i18n.localize(item.name)} (${cacheCost})<i class="fas fa-question-circle" data-tooltip="${game.i18n.localize(item.system.description)}"></i>`;
      html += `</label>`;
      return html;
    }
    let displayProsperity = function(level, items, availableCaches, dialogId, isFree) {
      const prosperityTitle = level != 0 ? `${game.i18n.localize('SFTD.ProsperityLevel')} ${level}` : game.i18n.localize('SFTD.StartingFoundations');
      let html = `<div class="prosperity-container flex-vertical" data-prosperity="${level}">`;
      html += `<label class="prosperity-title">${prosperityTitle}</label>`;
      for (const item of Object.values(items.filter(i => i.system.prosperity_level == level)))
        html += displayFoundation(item, availableCaches, dialogId, isFree);
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
    html += `<div class="free-toggle flex-horizontal"><label>${game.i18n.localize('SFTD.IsFree')}</label><input type="checkbox"></div>`;
    html += `<div class="objects-to-add flex-vertical">`;
    for (const prosperityLevel of Object.keys(prosperityOccurrences)) {
      if (prosperityLevel == 0) continue;
      html += displayProsperity(prosperityLevel, items, availableCaches, dialogId, false);
    }
    html += displayProsperity(0, items, availableCaches, dialogId, false);
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
          await this.addItemsToSheet('foundation', itemsToAddElements, null, true, null, dialog.isFoundationFree ? {system: {cache_cost: 0}} : null);
        if (result == 'addAsProject') {
          let items = await BladesHelpers.getAllObjectDocumentsByType('foundation', [], game);
          let itemsToAdd = [];
          itemsToAddElements.find('input:checked').each(function() {
            let item = items.find(e => e._id === $(this).val());
            if (item)
              itemsToAdd.push(items.find(e => e._id === $(this).val()));
          });
          for (let itemToAdd of itemsToAdd)
            await BladesHelpers.addProject(dialog.actor, itemToAdd, dialog.isFoundationFree);
        }
      }
    });

    dialog.actor = this.actor;
    dialog._onFirstRender = this.dialogOnFirstRender;
    dialog.isFoundationFree = false;
    dialog.displayFoundation = displayFoundation;
    dialog.displayProsperity = displayProsperity;
    await dialog.render(true);

    function addObjectToAddEvents(dialog) {
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

    for (const element of dialog.element.querySelectorAll('.free-toggle input')) {
      element.addEventListener('click', async (ev) => {
        const element = ev.currentTarget;
        dialog.isFoundationFree = element.checked;
        const dialogContentElement = element.closest('.dialog-content');
        for (const prosperityContainerElement of dialogContentElement.querySelectorAll('.prosperity-container'))
          prosperityContainerElement.outerHTML = displayProsperity(Number(prosperityContainerElement.dataset.prosperity), items, availableCaches, dialogId, element.checked);
        addObjectToAddEvents(dialog);
        let availableCachesSpanElement = dialogContentElement.querySelector('.available-caches span');
        availableCachesSpanElement.innerHTML = '';
      });
    }

    addObjectToAddEvents(dialog);
  }

  /* -------------------------------------------- */

  /**
   * Call a popup for starting a mission.
   */
  async startMissionPopup() {
    let extraData = {};
    extraData.tier = this.actor.getTier();

    let scarredStridersWithNoCutLoose = [];
    for (let member of Object.values(this.actor.system.members)) {
      let memberFull = BladesHelpers.resolveActor(member.uuid);
      if (!memberFull || memberFull.type != 'strider') continue;
      let scars = Number(memberFull.system.scars.value);
      if (scars > 0 && !memberFull.system.downtime_activities.cutLoose)
        scarredStridersWithNoCutLoose.push(memberFull);
    }
    extraData.scarredStriders = scarredStridersWithNoCutLoose.map(p => `<option value="${p.uuid}" selected>${p.name}</option>`);
    extraData.scarredStridersCount = scarredStridersWithNoCutLoose.length;

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('SFTD.StartMission')}` },
      content: await foundry.applications.handlebars.renderTemplate('systems/songs-for-the-dusk/templates/popups/start-mission.html', {extraData: extraData}),
      classes: ['start-mission'],
      buttons: [
        {
          icon: 'fas fa-person-walking',
          label: game.i18n.localize('SFTD.StartMission'),
          action: 'start-mission',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'start-mission') return;

        let messageContents = '';

        if (dialog.element.querySelector('[name="cutLooseScar"]').checked && dialog.element.querySelector('[name="cutLooseScarStriders"]')) {
          let selectedOptions = dialog.element.querySelector('[name="cutLooseScarStriders"]').selectedOptions;
          let cutLooseScarMessage = '';
          for (let selectedOption of selectedOptions) {
            let memberFull = BladesHelpers.resolveActor(selectedOption.value);
            let scars = Number(memberFull.system.scars.value);
            let resultStress = Math.max(Math.min(Number(memberFull.system.stress.value) + scars, memberFull.system.stress.max), 0);
            await BladesHelpers.tryUpdate(memberFull, {'system.stress.value': resultStress});
            cutLooseScarMessage += ` ${game.i18n.format('SFTD.StartMissionNoCutLooseScarStriderEffect', {strider: memberFull.name, num: scars})}`;
          }
          if (cutLooseScarMessage)
            messageContents += `<div class="description"><p>${game.i18n.localize('SFTD.StartMissionNoCutLooseScarEffect')}${cutLooseScarMessage}</p></div>`;
        }

        // Reset Downtime Activities & Melody for all Striders
        let melodyUsed = false;
        for (let member of Object.values(this.actor.system.members)) {
          let memberFull = BladesHelpers.resolveActor(member.uuid);
          if (!memberFull || memberFull.type != 'strider') continue;
          melodyUsed ||= !memberFull.system.melody;
          await BladesHelpers.tryUpdate(memberFull, {'system.==downtime_activities': {train_types: {}}, 'system.melody': true});
        }
        if (melodyUsed)
          messageContents += `<div class="description"><p>${game.i18n.localize('SFTD.StartMissionRecoverMelody')}</p></div>`;

        // Set Phase to Mission
        await BladesHelpers.tryUpdate(this.actor, {'system.phase': 'mission'});

        let speaker = {
          actor: this.actor._id,
          alias: this.actor.name,
          scene: null,
          token: this.actor.prototypeToken._id
        };
        let messageData = {
          speaker: speaker,
          content: await foundry.applications.handlebars.renderTemplate('systems/songs-for-the-dusk/templates/chat/start-mission.html', { contents: messageContents })
        }
        SFTDChatMessage.create(messageData);
      }
    });
    await dialog.render(true);
  }

  /**
   * Call a popup for finishing a mission.
   */
  async endMissionPopup() {
    let extraData = {};
    extraData.vendettas = BladesHelpers.fetchAllRelationships(this.actor).filter(r => r.status == -3).map(r => BladesHelpers.resolveActor(r.owner)).filter(r => r != null).map(r => r.name).join(', ');
    if (extraData.vendettas == '')
      extraData.vendettas = 'SFTD.None';

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('SFTD.EndMission')}` },
      content: await foundry.applications.handlebars.renderTemplate('systems/songs-for-the-dusk/templates/popups/end-mission.html', { rep_tiers: Array(6).fill().map((_, i) => `<option value="${i}"${i == 0 ? ' selected' : ''}>${i}</option>`).join(''), extraData: extraData}),
      classes: ['end-mission'],
      buttons: [
        {
          icon: 'fas fa-bed',
          label: game.i18n.localize('SFTD.EndMission'),
          action: 'end-mission',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'end-mission') return;

        let messageContents = '';

        // Reset Strider Downtime Activities
        for (let member of Object.values(this.actor.system.members)) {
          let memberFull = BladesHelpers.resolveActor(member.uuid);
          if (memberFull && memberFull.type == 'strider')
            BladesHelpers.tryUpdate(memberFull, {'system.downtime_count.value': memberFull.system.downtime_count.base});
        }

        // Set Phase to Downtime & Reset Cohort Downtime Activity for All Hands
        BladesHelpers.tryUpdate(this.actor, {'system.phase': 'downtime', 'system.cohort_downtime_done': false});

        let speaker = {
          actor: this.actor._id,
          alias: this.actor.name,
          scene: null,
          token: this.actor.prototypeToken._id
        };
        let messageData = {
          speaker: speaker,
          content: await foundry.applications.handlebars.renderTemplate('systems/songs-for-the-dusk/templates/chat/end-mission.html', { contents: messageContents })
        }
        SFTDChatMessage.create(messageData);
      }
    });
    await dialog.render(true);

    for (let element of dialog.element.querySelectorAll('.collapse-category legend'))
      element.addEventListener('click', (ev) => {
        let element = ev.currentTarget;
        let fieldSetElement = element.parentElement;
        fieldSetElement.classList.add('collapsed-category');
      });
    for (let element of dialog.element.querySelectorAll('div:has(+ .collapse-category)'))
      element.addEventListener('click', (ev) => {
        let element = ev.currentTarget;
        let fieldSetElement = element.nextElementSibling;
        fieldSetElement.classList.remove('collapsed-category');
      });
  }

  /**
   * Call a popup for finishing a session.
   */
  async endSessionPopup() {
    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('SFTD.EndSessionCheatSheet')}` },
      content: await foundry.applications.handlebars.renderTemplate('systems/songs-for-the-dusk/templates/popups/end-session.html', {}),
      classes: ['end-session'],
      buttons: [
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Close'),
          action: 'close',
        }
      ],
    });
    await dialog.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Call a popup for creating a specialist roll.
   */
  async createSpecialistRollPopup(specialistFull, groupActionData) {
    // Fetch roll modifiers
    let [_, allPermanentModifiers, allConditionalModifiers] = this.actor.getModifiers(specialistFull);
    allPermanentModifiers = await resolveRollModifierArray(allPermanentModifiers, specialistFull);
    allConditionalModifiers = await resolveRollModifierArray(allConditionalModifiers, specialistFull);
    allConditionalModifiers = pruneInvalidConditionalRollModifiers(specialistFull, allConditionalModifiers);

    let rollTypes = groupActionData ? ['groupSpecialist'] : ['specialist'];
    let missingRollTypes = {};
    if (this.actor.system.all_hands && !groupActionData) {
      rollTypes = rollTypes.concat(['reducePressure', 'longTermProject']);
      if (!Object.values(this.actor.system.projects).filter(p => Number(p.clock.value) < Number(p.clock.max)).length) {
        missingRollTypes[game.i18n.localize('SFTD.LongTermProjectRoll')] = game.i18n.localize('SFTD.BadRoll.NoOngoingLTP');
        rollTypes.splice(rollTypes.indexOf('longTermProject'), 1);
      }
    }

    let title = game.i18n.localize(`SFTD.${groupActionData ? 'Group' : ''}SpecialistRoll`);
    let dialog = new foundry.applications.api.DialogV2({
      window: { title: title },
      content: buildRollPopup(title, specialistFull, rollTypes, missingRollTypes),
      buttons: [
        {
          icon: 'fas fa-check',
          label: `${game.i18n.localize('SFTD.Roll')}`,
          action: 'roll',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'roll') return;

        let html = $(dialog.element);
        let extraDice = parseInt(html.find('[name="mod"]')[0].value);
        let withinExpertise = html.find('[name="expertise"]')[0].checked;
        let note = html.find('[name="note"]')[0].value;

        // Fetch actor roll modifiers & enabled conditional roll modifiers
        let enabledConditionalModifiers = resolveConditionalModifiers(dialog, specialistFull);
        enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);

        let input = html.find('input[type=radio]:checked');
        if (input.length > 0) {
          let rollType = input[0].id.split('-')[0];
          let diceAmount = specialistFull.system.quality + extraDice;
          let extraFields = { roll_type: rollType, within_expertise: withinExpertise, modifiers: [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ], actor: specialistFull };
          switch (rollType) {
            case 'specialist':
              await bladesRoll(specialistFull.system.quality + extraDice, 'SFTD.SpecialistRoll', note, extraFields);
              break;
            case 'groupSpecialist':
              extraFields.group_action = groupActionData;
              await bladesRoll(specialistFull.system.quality + extraDice, 'SFTD.GroupSpecialistRoll', note, extraFields);
              break;
            case 'reducePressure':
              await bladesRoll(diceAmount, 'SFTD.ReducePressureRoll', note, extraFields);
              break;
            case 'longTermProject':
              let ltpSelect = dialog.element.querySelector('[name="ltpId"]');
              if (ltpSelect.multiple) {
                extraFields.ltpIds = [];
                for (let selectedOption of ltpSelect.selectedOptions)
                  extraFields.ltpIds.push(selectedOption.value);
              } else
                extraFields.ltpId = ltpSelect.value;
              await bladesRoll(diceAmount, 'SFTD.LongTermProjectRoll', note, extraFields);
              break;
            default:
              break;
          }
          if (rollType != 'specialist'&& rollType != 'groupSpecialist')
            await BladesHelpers.tryUpdate(this.actor, {system: {'==specialist_downtime_done': true}});
          await postRollProcessing(this.actor, extraFields);
        }
      }
    });
    dialog.allPermanentModifiers = allPermanentModifiers;
    dialog.allConditionalModifiers = allConditionalModifiers;
    dialog.attributeName = '';
    dialog.rollTypes = rollTypes;
    dialog._onFirstRender = dialogOnFirstRender;
    dialog._onRender = dialogOnRender;
    dialog.refreshModifiers = refreshModifiers;
    dialog.actor = this.actor;
    await dialog.render(true);

    for (let element of dialog.element.querySelectorAll('input[type=radio]')) {
      element.addEventListener('click', (ev) => {
        let element = ev.currentTarget;
        let rollType = element.id.split('-')[0];
        let rollButton = element.closest('.window-content').querySelector('button[data-action="roll"]');
        let rollButtonText = `${game.i18n.localize('SFTD.Roll')} (${game.i18n.localize(`SFTD.DowntimeCohortRoll${dialog.actor.system.cohort_downtime_done ? 'Done' : ''}`)})`;
        if (rollType == 'specialist' || rollType == 'groupSpecialist')
          rollButtonText = `${game.i18n.localize('SFTD.Roll')}`;
        rollButton.querySelector('span').innerHTML = rollButtonText;
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

    html.find('.specialist-block-wrapper .add-specialist-roll').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let specialistId = element.data('itemId');
      let specialistFull = this.actor.items.filter(i => i._id == specialistId)[0];
      await this.createSpecialistRollPopup(specialistFull);
    })

    html.find('.add-group-action').click(async ev => {
      await this.createGroupActionPopup();
    })

    html.find('.start-mission').click(async ev => {
      await this.startMissionPopup();
    })

    html.find('.end-mission').click(async ev => {
      await this.endMissionPopup();
    })

    html.find('.end-session').click(async ev => {
      await this.endSessionPopup();
    })
  }
}

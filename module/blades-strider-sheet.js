import { BladesSheet } from "./blades-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { BladesHelpers } from "./blades-helpers.js";
import { bladesPopupData, BladesPopup } from "./blades-popup.js";
import { SFTDChatMessage } from "./messages/sftd-chat-message.js";
import { enrichHTML } from "./compat.js";
import { bladesRoll, simpleRollPopup, buildRollPopup, resolveRollModifierArray, resolveConditionalModifiers,
  checkDowntimeRules, dialogOnFirstRender, dialogOnRender, refreshModifiers, postRollProcessing,
  pruneInvalidConditionalRollModifiers, keepValidModifiersFromOther, rollTypeLabels } from './blades-roll.js';

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
    let load = 0;
    sheetData.items.forEach(i => {
      let itemLoad = 0;
      if (i.type === "item") {
        itemLoad = parseInt(i.system.load);
        if (sheetData.system.signature_gear?.id == i.system.original_id) itemLoad --;
        if (sheetData.system.crew?.system.signature_gear?.id == i.system.original_id) itemLoad --;
      }
      load += Math.max(itemLoad, 0);
    });
    sheetData.system.load = load;

    sheetData.system.description = await enrichHTML(sheetData.system.description, {
      secrets: sheetData.owner,
      async: true
    });

    // Catch unmigrated actor data
    [sheetData.system.modifiers, sheetData.system.roll_modifiers, sheetData.system.conditional_roll_modifiers] = this.actor.getModifiers();
    this.actor.applyModifiers(sheetData);

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
      if (i.type === "ability" && i.name === "(C) Mule")
        mule_present = true;
    });
    sheetData.system.load_level = mule_present ? mule_level[load] : load_level[load];

    if (game.settings.get('songs-for-the-dusk', 'DeepCutLoad')) {
      sheetData.system.load_levels = {"SFTD.Discreet": "SFTD.Discreet", "SFTD.Conspicuous": "SFTD.Conspicuous"};
    } else {
      sheetData.system.load_levels = {
        "SFTD.Light": "SFTD.Light",
        "SFTD.Normal": "SFTD.Normal",
        "SFTD.Heavy": "SFTD.Heavy"
      };
    }

    for (let item of sheetData.items)
      if (item.system.popup != '') {
        let popupData = bladesPopupData[item.system.popup];
        if (popupData?.button_text)
          item.system.popup_text = popupData.button_text;
      }

    // Check for additional stress from crew sources
    sheetData.system.scars.value = Object.values(sheetData.system.scars.values).filter(s => s != '').length;

    sheetData.orderedItems = sheetData.items.sort(BladesHelpers.itemEntryCompareFunc);

    sheetData.defaultClockThemeColor = game.settings.get('songs-for-the-dusk', 'DefaultClockThemeColor');

    return sheetData;
  }

  /* -------------------------------------------- */

  /** @override */
  async handleAddedObjects(droppedEntitiesFull) {
    for (let droppedEntityFull of droppedEntitiesFull) {
      if (!droppedEntityFull || droppedEntityFull.uuid == this.actor.uuid)
        continue;

      switch (droppedEntityFull.type) {
        case 'crew':
          await BladesHelpers.addCrewStrider(droppedEntityFull, this.actor, false);
          break;
        case 'class':
          await this.addItemAsObjectAndStoreReference(droppedEntityFull, 'system.class');
          break;
        case 'item':
        case 'ability':
          await this.addItemsToSheet([droppedEntityFull]);
          break;
        default:
          break;
      }
    }
  }

  /* -------------------------------------------- */

  async _onMelodyToggleLeftClick(event) {
    if (!event.target.classList.contains('fa-music-note'))
      await BladesHelpers.tryUpdate(this.actor, {'system.==melody': true});
    else
      await this.melodyUsagePopup();
  }

  async _onMelodyToggleRightClick(event) {
    await BladesHelpers.tryUpdate(this.actor, {'system.==melody': !event.target.classList.contains('fa-music-note')});
  }

  /**
   * Call a popup for using melody.
   */
  async melodyUsagePopup() {
    let melodyOptions = '';
    for (const melodyOption of this.actor.system.melody_options) {
      const optionText = game.i18n.localize(`SFTD.MelodyOptions.${melodyOption}`);
      melodyOptions += `
      <div class="radio-group">
        <label>
          <input type="radio" data-text="${optionText[0].toLowerCase() + optionText.slice(1)}" name="melodyOption" ${melodyOptions.length == 0 ? 'checked' : ''}> ${optionText}
        </label>
      </div>`;
    }

    if (!melodyOptions) {
      ui.notifications.warn(game.i18n.localize('SFTD.log.warn.NoMelodyOptions'));
      return;
    }

    const contents = `
      <h2>${game.i18n.localize('SFTD.UseMelody')}</h2>
      <form>
        <fieldset class="form-group melody-options">
          <legend>${game.i18n.localize('SFTD.MelodyUsageOptions')}</legend>
          ${melodyOptions}
        </fieldset>
        <div class="form-group">
          <label>${game.i18n.localize('SFTD.Notes')}:</label>
          <input id="note" name="note" type="text" value="">
        </div>
      </form>`;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('SFTD.UseMelody')}` },
      content: contents,
      buttons: [
        {
          icon: 'fas fa-burst',
          label: game.i18n.localize('SFTD.UseMelody'),
          action: 'use',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'use') return;

        let html = $(dialog.element);
        let input = dialog.element.querySelector('input[type=radio]:checked');
        let note = dialog.element.querySelector('[name="note"]').value;
        if (input) {
          let contents = input.dataset.text;
          let speaker = {
            actor: this.actor._id,
            alias: this.actor.name,
            scene: null,
            token: this.actor.prototypeToken._id
          };
          let messageData = {
            speaker: speaker,
            content: await foundry.applications.handlebars.renderTemplate('systems/songs-for-the-dusk/templates/chat/melody-usage.html', { contents: contents, note: note })
          }
          await ChatMessage.create(messageData);

          await BladesHelpers.tryUpdate(this.actor, {'system.==melody': false});
        }
      }
    });
    dialog.render(true);
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html.find('.melody-toggle').click(ev => {
      ev.preventDefault();
      this._onMelodyToggleLeftClick(ev);
    });
    html.find('.melody-toggle').contextmenu(ev => { this._onMelodyToggleRightClick(ev); });

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
    html.find('.delete-crew').click(async _ => {
      await BladesHelpers.removeCrewStrider(this.actor);
    });

    // Delete Signature Gear
    html.find('.delete-signature-gear').click(async _ => {
      await BladesHelpers.tryUpdate(this.actor, {'system.signature_gear': null});
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

    html.find('.other-rolls').click(async _ => {
      await simpleRollPopup('SFTD.OtherRoll', 'SFTD.OtherRollFull', this.actor, false);
    });

    // Downtime Roll Menu
    html.find('.downtime').click(async _ => await this.downtimeRollPopup(this));

    html.find('.generic-popup').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let itemFull = this.actor.items.get(element.data('itemId'));
      let popupData = bladesPopupData[itemFull.system.popup];
      if (!popupData)
        ui.notifications.error(game.i18n.format('SFTD.log.error.BadPopupID', {id: itemFull.system.popup}), { permanent: true });
      else {
        popupData.key = itemFull.system.popup;
        await BladesPopup.instantiatePopup(this.actor, itemFull, popupData);
      }
    });
  }

  async downtimeRollPopup(actorSheet, forcedRollTypes = null) {
    // Fetch roll modifiers
    let [__, allPermanentModifiers, allConditionalModifiers] = actorSheet.actor.getModifiers();
    allPermanentModifiers = await resolveRollModifierArray(allPermanentModifiers, actorSheet.actor);
    allConditionalModifiers = await resolveRollModifierArray(allConditionalModifiers, actorSheet.actor, true);
    allConditionalModifiers = pruneInvalidConditionalRollModifiers(actorSheet.actor, allConditionalModifiers);

    let [rollTypes, missingRollTypes] = actorSheet.getDowntimeRollTypesToRemove(forcedRollTypes);
    let title = game.i18n.localize(rollTypes.length == 1 ? rollTypeLabels[rollTypes[0]] : 'SFTD.DowntimeActivity');

    if (rollTypes.length == 0) {
      ui.notifications.warn(game.i18n.format('SFTD.log.warn.NoRollType'));
      return;
    }

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: title },
      content: buildRollPopup(title, actorSheet.actor, rollTypes, missingRollTypes),
      buttons: [
        {
          icon: 'fas fa-check',
          label: `${game.i18n.localize('SFTD.Roll')}${rollTypes.length == 1 ? '' : ` (${game.i18n.format('SFTD.DowntimeRollLeft', {num: Math.max(actorSheet.actor.system.downtime_count.value, 0)})})`}`,
          action: 'roll'
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Close'),
          action: 'close'
        },
      ],
      submit: async (result, dialog) => {
        if (result != 'roll') return;

        let html = $(dialog.element);
        let extraDice = parseInt(html.find('[name="mod"]')[0].value);
        let note = html.find('[name="note"]')[0].value;

        // Fetch enabled conditional roll modifiers by HTML inspection
        let enabledConditionalModifiers = resolveConditionalModifiers(dialog, actorSheet.actor);
        enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);

        let input = html.find('input[type=radio]:checked');
        if (input.length > 0) {
          let rollType = input[0].id.split('-')[0];
          let extraFields = { roll_type: rollType, modifiers: [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ], actor: actorSheet.actor };
          let crewFull = BladesHelpers.resolveActor(actorSheet.actor.system.crew);
          switch (rollType) {
            case 'constructFoundation':
              let constructFoundationAction = dialog.element.querySelector('#cfAction').value;
              let constructFoundationNewFoundation = dialog.constructFoundationNewFoundation;
              let constructFoundationNewFoundationCost = dialog.element.querySelector('#cfNewFoundationCost')?.value;
              let constructFoundationFoundation = Number(dialog.element.querySelector('#cfFoundation').value);
              let constructFoundationDice = actorSheet.actor.getRollData().diceAmount[constructFoundationAction] ?? 0 + extraDice;
              if (constructFoundationNewFoundation) {
                let newFoundation = foundry.utils.deepClone(constructFoundationNewFoundation);
                newFoundation.system.cache_cost = Number(constructFoundationNewFoundationCost);
                await BladesHelpers.addProject(crewFull, newFoundation);
                constructFoundationFoundation = Object.values(crewFull.system.projects).length - 1;
              }
              extraFields.cfId = constructFoundationFoundation;
              extraFields.isNewFoundation = constructFoundationNewFoundation != null;
              await bladesRoll(constructFoundationDice, 'SFTD.ConstructFoundationRoll', note, extraFields);
              break;
            case 'cutLooseBegin':
              extraFields.noRoll = true;
              extraFields.participants = [actorSheet.actor.uuid];
              let cutLooseParticipants = dialog.element.querySelector('#cutLooseParticipants');
              for (let selectedOption of cutLooseParticipants.selectedOptions)
                extraFields.participants.push(selectedOption.value);
              await bladesRoll(0, 'SFTD.CutLooseBeginRoll', note, extraFields);
              break;
            case 'cutLoose':
              let cutLooseDice = actorSheet.actor.getRollData().diceAmount['SFTD.CutLoose'] + extraDice;
              await bladesRoll(cutLooseDice, 'SFTD.CutLooseRoll', note, extraFields);
              break;
            case 'longTermProject':
              let ltpAction = dialog.element.querySelector('#ltpAction').value;
              let ltpDice = actorSheet.actor.getRollData().diceAmount[ltpAction] + extraDice;
              extraFields.ltpId = dialog.element.querySelector('#ltpId').value;
              await bladesRoll(ltpDice, 'SFTD.LongTermProjectRoll', note, extraFields);
              break;
            case 'recover':
              extraFields.noRoll = true;
              await bladesRoll(0, 'SFTD.RecoverRoll', note, extraFields);
              break;
            case 'reducePressure':
              let rpAction = dialog.element.querySelector('#rpAction').value;
              let rpDice = actorSheet.actor.getRollData().diceAmount[rpAction] + extraDice;
              extraFields.rpHazard = dialog.element.querySelector('#rpHazard')?.checked;
              await bladesRoll(rpDice, 'SFTD.ReducePressureRoll', note, extraFields);
              break;
            case 'train':
              extraFields.noRoll = true;
              let trainType = html.find('[name="trainType"]')[0].value;
              extraFields.trainType = trainType;
              await bladesRoll(0, 'SFTD.TrainRoll', note, extraFields);
              break;
            case 'unwind':
              let unwindDice = actorSheet.actor.getRollData().diceAmount['SFTD.CutLoose'] + extraDice;
              extraFields.unwindNPC = dialog.element.querySelector('#unwindNpc').value;
              await bladesRoll(unwindDice, 'SFTD.UnwindRoll', note, extraFields);
              break;
            case 'moveCity':
              extraFields.noRoll = true;
              await bladesRoll(0, 'SFTD.MoveCityRoll', note, extraFields);
              break;
            default:
              ui.notifications.warn(game.i18n.format('SFTD.log.warn.UnknownRollType', { type: input[0].id.split('-')[0] }));
          }
          await postRollProcessing(actorSheet.actor, extraFields);
        }
      }
    });
    dialog.allPermanentModifiers = allPermanentModifiers;
    dialog.allConditionalModifiers = allConditionalModifiers;
    dialog.attributeName = '';
    dialog.rollTypes = rollTypes;
    dialog._onFirstRender = dialogOnFirstRender;
    dialog._onRender = function(context, options) {
      dialogOnRender(context, options, this);

      let allowedToRoll = true;
      let input = this.element.querySelector('input[type=radio]:checked');
      if (input) {
        let rollType = input.id.split('-')[0];
        if (rollType == 'constructFoundation')
          allowedToRoll = dialog.isConstructFoundationValid(dialog);
      }

      allowedToRoll &&= checkDowntimeRules(this);
      this.element.querySelector('[data-action="roll"]').disabled = !allowedToRoll;
    };
    dialog.constructFoundationNewFoundation = null;
    dialog.refreshModifiers = refreshModifiers;
    dialog.actor = this.actor;
    dialog.isConstructFoundationValid = function(dialog) {
      let element = dialog.element;
      let hasNewFoundation = element.querySelector('#cfNewFoundation > .actor-contents') != null;
      let crewFull = BladesHelpers.resolveActor(dialog.actor.system.crew);
      let newFoundationTooCostly = Number(element.querySelector('#cfNewFoundationCost').value ?? 0) > (crewFull.system.cache.value - crewFull.sheet.getInvestedCaches());
      let hasSelectedValidFoundation = element.querySelector('#cfFoundation').value != 'None';
      return !(newFoundationTooCostly || !(hasNewFoundation ^ hasSelectedValidFoundation));
    }
    await dialog.render(true);

    let htmlElement = $(dialog.element);
    htmlElement[0].ondrop = async function(ev) {
      ev.preventDefault();
      const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
      if (dropData.uuid) {
        let dropFull = BladesHelpers.resolveActor(dropData.uuid);
        if (dropFull.type == 'foundation') {
          if (dropFull.pack)
            dropFull = await game.packs.contents.find(p => p.metadata.id == dropFull.pack).getDocument(dropFull._id);
          dialog.constructFoundationNewFoundation = dropFull;
          // Drop a Foundation for the Construct Foundation roll
          $(this).find('#cfNewFoundation')[0].innerHTML = `
            <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
              <a class="item-name">${dropFull.name}</a>
              <a class="delete-actor"><i class="fas fa-times"></i></a>
            </div>`;
          $(this).find('#cfNewFoundationCost')[0].innerHTML = Array(9).fill().map((_, i) => `<option value="${i}"${i == dropFull.system.cache_cost ? ' selected' : ''}>${i}</option>`).join('')
          $(this).find('#cfNewFoundation .delete-actor')[0].onclick = function (ev) {
            dialog.constructFoundationNewFoundation = null;
            let rollType = $(this).closest('.form-group').find('input[type=radio]:checked')[0].id.split('-')[0];
            $(this).closest('.radio-group').find('#cfNewFoundationCost')[0].innerHTML = '';
            $(this).closest('#cfNewFoundation')[0].innerHTML = game.i18n.localize('SFTD.None');
            if (rollType == 'constructFoundation')
              $(this).closest('.window-content').find('button[data-action="roll"]')[0].disabled = !dialog.isConstructFoundationValid(dialog) || !checkDowntimeRules(dialog);
          }
          let rollType = $(this).find('input[type=radio]:checked')[0].id.split('-')[0];
          if (rollType == 'constructFoundation')
            $(this).find('[data-action="roll"]')[0].disabled = !dialog.isConstructFoundationValid(dialog) || !checkDowntimeRules(dialog);
        }
      }
    };
    for (let element of htmlElement.find('input[type=radio]')) {
      element.onclick = function (ev) {
        let rollType = this.id.split('-')[0];
        let rollButton = $(this).closest('.window-content').find('button[data-action="roll"]')[0];
        let allowedToRoll = true;
        if (rollType == 'constructFoundation')
          allowedToRoll = dialog.isConstructFoundationValid(dialog);

        allowedToRoll &&= checkDowntimeRules(dialog);
        rollButton.disabled = !allowedToRoll;
      };
    }
    if (dialog.element.querySelector('#cfNewFoundationCost'))
      dialog.element.querySelector('#cfNewFoundationCost').addEventListener('change', (ev) => {
        let element = ev.currentTarget;
        let rollType = element.closest('.form-group').querySelector('input[type=radio]:checked').id.split('-')[0];
        if (rollType == 'constructFoundation')
          element.closest('.window-content').querySelector('button[data-action="roll"]').disabled = !dialog.isConstructFoundationValid(dialog) || !checkDowntimeRules(dialog);
      });
    if (dialog.element.querySelector('#cfFoundation'))
      dialog.element.querySelector('#cfFoundation').addEventListener('change', (ev) => {
        let element = ev.currentTarget;
        let rollType = element.closest('.form-group').querySelector('input[type=radio]:checked').id.split('-')[0];
        if (rollType == 'constructFoundation')
          element.closest('.window-content').querySelector('button[data-action="roll"]').disabled = !dialog.isConstructFoundationValid(dialog) || !checkDowntimeRules(dialog);
      });
    if (dialog.element.querySelector('#cutLooseParticipants'))
      dialog.element.querySelector('#cutLooseParticipants').addEventListener('change', (ev) => {
        let element = ev.currentTarget;
        let rollType = element.closest('.form-group').querySelector('input[type=radio]:checked').id.split('-')[0];
        if (rollType == 'cutLooseBegin')
          element.closest('.window-content').querySelector('button[data-action="roll"]').disabled = !Array.from(element.selectedOptions).length;
      });
  }

  // Remove unavailable roll types
  getDowntimeRollTypesToRemove(forcedRollTypes = null) {
    let rollTypes = forcedRollTypes ?? ['constructFoundation', 'cutLooseBegin', 'longTermProject', 'moveCity', 'recover', 'reducePressure', 'train', 'unwind'];
    let missingRollTypes = {};

    let trainTypes = ['playbook', 'analysis', 'kinesis', 'semiosis'];
    for (let usedTrainType of Object.keys(this.actor.system.downtime_activities.train_types))
      trainTypes.splice(trainTypes.indexOf(usedTrainType), 1);
    if (trainTypes.length == 0)
      BladesHelpers.addToRollTypeError(missingRollTypes, 'train', 'SFTD.BadRoll.NoTraining');
    if (!this.actor.system.harm.light.one && !this.actor.system.harm.light.two && !this.actor.system.harm.medium.one && !this.actor.system.harm.medium.two && !this.actor.system.harm.heavy.one && !this.actor.system.harm.deadly.one)
      BladesHelpers.addToRollTypeError(missingRollTypes, 'recover', 'SFTD.BadRoll.NoHarm');
    if (Number(this.actor.system.stress.value) <= 0) {
      BladesHelpers.addToRollTypeError(missingRollTypes, 'cutLooseBegin', 'SFTD.BadRoll.NoStress');
      BladesHelpers.addToRollTypeError(missingRollTypes, 'cutLoose', 'SFTD.BadRoll.NoStress');
      BladesHelpers.addToRollTypeError(missingRollTypes, 'unwind', 'SFTD.BadRoll.NoStress');
    }
    let crewFull = BladesHelpers.resolveActor(this.actor.system.crew);
    if (!crewFull) {
      BladesHelpers.addToRollTypeError(missingRollTypes, 'cutLooseBegin', 'SFTD.BadRoll.NoCrew');
      BladesHelpers.addToRollTypeError(missingRollTypes, 'cutLoose', 'SFTD.BadRoll.NoCrew');
      BladesHelpers.addToRollTypeError(missingRollTypes, 'longTermProject', 'SFTD.BadRoll.NoCrew');
      BladesHelpers.addToRollTypeError(missingRollTypes, 'moveCity', 'SFTD.BadRoll.NoCrew');
      BladesHelpers.addToRollTypeError(missingRollTypes, 'reducePressure', 'SFTD.BadRoll.NoCrew');
    } else {
      if (!Object.values(crewFull.system.members).map(m => BladesHelpers.resolveActor(m)).filter(m => m != null && m != this.actor && m.type == 'strider' && m.system.stress.value > 0).length)
        BladesHelpers.addToRollTypeError(missingRollTypes, 'cutLooseBegin', 'SFTD.BadRoll.NoOtherStressedStrider');
      if (!Object.values(crewFull.system.projects).filter(p => p.clock.value < p.clock.max && !p.foundation).length)
        BladesHelpers.addToRollTypeError(missingRollTypes, 'longTermProject', 'SFTD.BadRoll.NoOngoingLTP');
      if (crewFull.system.pressure.value == 0 && crewFull.system.hazard.value == 0)
        BladesHelpers.addToRollTypeError(missingRollTypes, 'reducePressure', 'SFTD.BadRoll.NoPressureHazard');
      if (!crewFull.system.mobile_city)
        BladesHelpers.addToRollTypeError(missingRollTypes, 'moveCity', 'SFTD.BadRoll.NoMobileCity');
    }
    return [
      rollTypes.filter(r => !Object.keys(missingRollTypes).includes(r)),
      Object.fromEntries(Object.entries(missingRollTypes).map((v, i) => [game.i18n.localize(`SFTD.${v[0][0].toUpperCase() + v[0].slice(1)}Roll`), v[1]]))
    ];
  }
}
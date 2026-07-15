import {BladesSheet} from "./blades-sheet.js";
import {BladesActiveEffect} from "./blades-active-effect.js";
import {BladesHelpers} from "./blades-helpers.js";
import { enrichHTML } from "./compat.js";
import { bladesRoll, simpleRollPopup, buildRollPopup, resolveRollModifierArray, resolveConditionalModifiers,
  checkDowntimeRules, dialogOnFirstRender, dialogOnRender, refreshModifiers, postRollProcessing,
  pruneInvalidConditionalRollModifiers, keepValidModifiersFromOther } from './blades-roll.js';

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

    // Check for additional stress from crew sources
    sheetData.system.scars.value = Object.values(sheetData.system.scars.values).filter(s => s != '').length;

    sheetData.defaultClockThemeColor = game.settings.get('songs-for-the-dusk', 'DefaultClockThemeColor');

    return sheetData;
  }

  /** @override */
  async _onDropItem(event, droppedItem) {
    await super._onDropItem(event, droppedItem);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this strider. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedItem);
  }

  /** @override */
  async _onDropActor(event, droppedActor) {
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this strider. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
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

    // Delete Signature Gear
    html.find('.delete-signature-gear').click(async ev => {
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

    html.find('.other-rolls').click(async (e) => {
      await simpleRollPopup('SFTD.OtherRoll', 'SFTD.OtherRollFull', this.actor, false);
    });

    // Downtime Roll Menu
    html.find('.downtime').click(async (e) => {
      // Fetch roll modifiers
      let [_, allPermanentModifiers, allConditionalModifiers] = this.actor.getModifiers();
      allPermanentModifiers = await resolveRollModifierArray(allPermanentModifiers, this.actor);
      allConditionalModifiers = await resolveRollModifierArray(allConditionalModifiers, this.actor);
      allConditionalModifiers = pruneInvalidConditionalRollModifiers(this.actor, allConditionalModifiers);

      let title = game.i18n.localize('SFTD.DowntimeActivity');
      let [rollTypes, missingRollTypes] = this.getDowntimeRollTypesToRemove();

      let dialog = new foundry.applications.api.DialogV2({
        window: { title: title },
        content: buildRollPopup(title, this.actor, rollTypes, missingRollTypes),
        buttons: [
          {
            icon: 'fas fa-check',
            label: `${game.i18n.localize('SFTD.Roll')} (${game.i18n.format('SFTD.DowntimeRollLeft', {num: Math.max(this.actor.system.downtime_count.value, 0)})})`,
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
          let enabledConditionalModifiers = resolveConditionalModifiers(dialog, this.actor);
          enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);

          let input = html.find('input[type=radio]:checked');
          if (input.length > 0) {
            let rollType = input[0].id.split('-')[0];
            let extraFields = { roll_type: rollType, modifiers: [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ], actor: this.actor };
            let crewFull = BladesHelpers.resolveActor(this.actor.system.crew);
            switch (rollType) {
              case 'acquireAsset':
                let acquireAssetSuccessTier = html.find('[name="acquireAssetSuccessTier"]')[0].value;
                let acquireAssetDiceAmount = Number(crewFull.system.tier.value) + extraDice;
                extraFields.tier = Number(crewFull.system.tier.value);
                extraFields.successTier = acquireAssetSuccessTier;
                await bladesRoll(acquireAssetDiceAmount, 'SFTD.AcquireAssetRoll', note, extraFields);
                break;
              case 'collect':
                let collectRegionUuid = html.find('#collectRegion > .actor-contents').data('actorId');
                let collectRegionVigilance = html.find('[name="collectVigilance"]')[0].value;
                let collectRegionFull = BladesHelpers.resolveActor(collectRegionUuid);
                extraFields.region = collectRegionFull;
                let collectDiceAmount = collectRegionFull.system.wealth - Number(collectRegionVigilance);
                await bladesRoll(collectDiceAmount, 'SFTD.CollectRoll', note, extraFields);
                break;
              case 'cutLoose':
                let connectionUuid = html.find('[name="connection"]')[0].value;
                let stress = Number(this.actor.system.stress.value);
                extraFields.connection = BladesHelpers.resolveActor(connectionUuid);
                extraFields.stress = parseInt(stress);
                let connection = Object.values(this.actor.system.connections).find(c => c.uuid == connectionUuid);
                let cutLooseDiceAmount = Number(connection.clock.value) + extraDice;
                await bladesRoll(cutLooseDiceAmount, 'SFTD.CutLooseRoll', note, extraFields);
                break;
              case 'enhance':
                extraFields.noRoll = true;
                await bladesRoll(0, 'SFTD.EnhanceRoll', note, extraFields);
                break;
              case 'fix':
                let fixActorUuid = html.find('[name="fixActor"]')[0].value;
                extraFields.fixActor = BladesHelpers.resolveActor(fixActorUuid);
                let fixDice = extraDice;
                if (extraFields.fixActor.type == 'character')
                  fixDice += extraFields.fixActor.getRollData().diceAmount['engineer'];
                else
                  fixDice += extraFields.fixActor.system.quality;
                await bladesRoll(fixDice, 'SFTD.FixRoll', note, extraFields);
                break;
              case 'longTermProject':
                let ltpAction = html.find('[name="ltpAction"]')[0].value;
                let ltpDice = this.actor.getRollData().diceAmount[ltpAction] + extraDice;
                let ltpSelect = dialog.element.querySelector('[name="ltpId"]');
                if (ltpSelect.multiple) {
                  extraFields.ltpIds = [];
                  for (let selectedOption of ltpSelect.selectedOptions)
                    extraFields.ltpIds.push(selectedOption.value);
                } else
                  extraFields.ltpId = ltpSelect.value;
                await bladesRoll(ltpDice, 'SFTD.LongTermProjectRoll', note, extraFields);
                break;
              case 'manufacture':
                let manufactureSuccessTier = html.find('[name="manufactureSuccessTier"]')[0].value;
                let manufactureAction = html.find('[name="manufactureAction"]')[0].value;
                let manufactureDiceAmount = this.actor.getRollData().diceAmount[manufactureAction] + extraDice;
                extraFields.tier = Number(crewFull.system.tier.value);
                extraFields.successTier = manufactureSuccessTier;
                await bladesRoll(manufactureDiceAmount, 'SFTD.ManufactureRoll', note, extraFields);
                break;
              case 'recover':
                extraFields.noRoll = true;
                await bladesRoll(0, 'SFTD.RecoverRoll', note, extraFields);
                break;
              case 'salvage':
                let salvageVehicleUuid = html.find('#salvageVehicle > .actor-contents').data('actorId');
                let salvageVehicleFull = BladesHelpers.resolveActor(salvageVehicleUuid);
                extraFields.salvageVehicle = salvageVehicleFull;
                let salvageDiceAmount = this.actor.getRollData().diceAmount['engineer'] + extraDice;
                await bladesRoll(salvageDiceAmount, 'SFTD.SalvageRoll', note, extraFields);
                break;
              case 'schmooze':
                let schmoozeFactionUuid = html.find('#schmoozeFaction > .actor-contents').data('actorId');
                let schmoozeFactionFull = BladesHelpers.resolveActor(schmoozeFactionUuid);
                extraFields.schmoozeFaction = schmoozeFactionFull;
                let schmoozeAction = html.find('[name="schmoozeAction"]')[0].value;
                let schmoozeDiceAmount = this.actor.getRollData().diceAmount[schmoozeAction] + extraDice;
                await bladesRoll(schmoozeDiceAmount, 'SFTD.SchmoozeRoll', note, extraFields);
                break;
              case 'train':
                extraFields.noRoll = true;
                let trainType = html.find('[name="trainType"]')[0].value;
                extraFields.trainType = trainType;
                await bladesRoll(0, 'SFTD.TrainRoll', note, extraFields);
                break;
              case 'moveBase':
                extraFields.noRoll = true;
                await bladesRoll(0, 'SFTD.MoveBaseRoll', note, extraFields);
                break;
              default:
                ui.notifications.warn(game.i18n.format('SFTD.log.warn.UnknownRollType', { type: input[0].id.split('-')[0] }));
            }
            await postRollProcessing(this.actor, extraFields);
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
          if (rollType == 'cutLoose')
            allowedToRoll = this.element.querySelector('#collectRegion > .actor-contents').dataset.actorId != null;
          else if (rollType == 'salvage')
            allowedToRoll = this.element.querySelector('#salvageVehicle > .actor-contents').dataset.actorId != null;
          else if (rollType == 'schmooze')
            allowedToRoll = this.element.querySelector('#schmoozeFaction > .actor-contents').dataset.actorId != null;
        }

        allowedToRoll &&= checkDowntimeRules(this);
        this.element.querySelector('[data-action="roll"]').disabled = !allowedToRoll;
      };
      dialog.refreshModifiers = refreshModifiers;
      dialog.actor = this.actor;
      await dialog.render(true);

      let htmlElement = $(dialog.element);
      htmlElement[0].ondrop = function(ev) {
        ev.preventDefault();
        const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
        if (dropData.uuid) {
          let dropFull = BladesHelpers.resolveActor(dropData.uuid);
          if (dropFull.type == 'region') {
            // Drop a Region for the Collect roll
            let rollType = $(this).find('input[type=radio]:checked')[0].id.split('-')[0];
            if (rollType == 'collect')
              $(this).find('[data-action="roll"]')[0].disabled = !checkDowntimeRules(dialog);
            $(this).find('#collectRegion')[0].innerHTML = `
              <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
                <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
                <a class="item-name">${dropFull.name}</a>
                <a class="delete-actor"><i class="fas fa-times"></i></a>
              </div>`;
            $(this).find('#collectVigilance').val(Math.min(dropFull.system.collect_vigilance, 10));
            $(this).find('#collectRegion .delete-actor')[0].onclick = function (ev) {
              let rollType = $(this).closest('.form-group').find('input[type=radio]:checked')[0].id.split('-')[0];
              if (rollType == 'collect')
                $(this).closest('.window-content').find('button[data-action="roll"]')[0].disabled = true;
              $(this).closest('#collectRegion')[0].innerHTML = game.i18n.localize('SFTD.None');
            }
          } else if (dropFull.type == 'vehicle') {
            // Drop a Vehicle for the Salvage roll
            if (dropFull.system.damage.deadly.one.includes(game.i18n.localize('SFTD.Salvaged'))) {
              ui.notifications.warn(game.i18n.format('SFTD.log.warn.SalvageVehicleAlreadySalvaged', {vehicle: dropFull.name}));
              return;
            }
            let rollType = $(this).find('input[type=radio]:checked')[0].id.split('-')[0];
            if (rollType == 'salvage') {
              let scroungersFreeActive = $(this).find('[data-modifier="scroungers_free"] input[type=checkbox]')[0].checked;
              $(this).find('[data-action="roll"]')[0].disabled = scroungersFreeActive || !checkDowntimeRules(dialog);
            }
            $(this).find('#salvageVehicle')[0].innerHTML = `
              <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
                <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
                <a class="item-name">${dropFull.name}</a>
                <a class="delete-actor"><i class="fas fa-times"></i></a>
              </div>`;
            $(this).find('#salvageVehicle .delete-actor')[0].onclick = function (ev) {
              let rollType = $(this).closest('.form-group').find('input[type=radio]:checked')[0].id.split('-')[0];
              if (rollType == 'salvage') {
                let scroungersFreeActive = $(this).closest('.window-content').find('[data-modifier="scroungers_free"] input[type=checkbox]')[0].checked;
                $(this).closest('.window-content').find('button[data-action="roll"]')[0].disabled = !scroungersFreeActive || !checkDowntimeRules(dialog);
              }
              $(this).closest('#salvageVehicle')[0].innerHTML = game.i18n.localize('SFTD.None');
            }
          } else if (dropFull.type == 'faction') {
            // Drop a Faction for the Schmooze roll
            let rollType = $(this).find('input[type=radio]:checked')[0].id.split('-')[0];
            if (rollType == 'schmooze')
              $(this).find('[data-action="roll"]')[0].disabled = !checkDowntimeRules(dialog);
            $(this).find('#schmoozeFaction')[0].innerHTML = `
              <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
                <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
                <a class="item-name">${dropFull.name}</a>
                <a class="delete-actor"><i class="fas fa-times"></i></a>
              </div>`;
            $(this).find('#schmoozeFaction .delete-actor')[0].onclick = function (ev) {
              let rollType = $(this).closest('.form-group').find('input[type=radio]:checked')[0].id.split('-')[0];
              if (rollType == 'schmooze')
                $(this).closest('.window-content').find('button[data-action="roll"]')[0].disabled = true;
              $(this).closest('#schmoozeFaction')[0].innerHTML = game.i18n.localize('SFTD.None');
            }
          }
        }
      };
      for (let element of htmlElement.find('input[type=radio]')) {
        element.onclick = function (ev) {
          let rollType = this.id.split('-')[0];
          let rollButton = $(this).closest('.window-content').find('button[data-action="roll"]')[0];
          let allowedToRoll = true;
          if (rollType == 'collect')
            allowedToRoll = $(this).closest('.radio-group').find('#collectRegion > .actor-contents').length != 0;
          else if (rollType == 'salvage')
            allowedToRoll = $(this).closest('.radio-group').find('#salvageVehicle > .actor-contents').length != 0;
          else if (rollType == 'schmooze')
            allowedToRoll = $(this).closest('.radio-group').find('#schmoozeFaction > .actor-contents').length != 0;

          allowedToRoll &&= checkDowntimeRules(dialog);
          rollButton.disabled = !allowedToRoll;

          for (let element of $(this).closest('.window-content').find('[data-modifier="scroungers_free"] input[type=checkbox]')) {
            element.onclick = function (ev) {
              let checked = ev.currentTarget.checked;
              let rollButton = $(this).closest('.window-content').find('button[data-action="roll"]')[0];
              let allowedToRoll = $(this).closest('.window-content').find('#salvageVehicle > .actor-contents').length != 0 ^ checked;
              allowedToRoll &&= checkDowntimeRules(dialog);
              rollButton.disabled = !allowedToRoll;
            };
          }
        };
      }
    });
  }

  // Remove unavailable roll types
  getDowntimeRollTypesToRemove() {
    let rollTypes = ['acquireAsset', 'cutLoose', 'longTermProject', 'manufacture', 'recover', 'schmooze', 'train', 'moveBase'];
    let missingRollTypes = {};

    let trainTypes = ['playbook'];
    for (let [trainTypeName, trainType] of Object.entries(this.actor.system.attributes))
      // No vehicle: Don't include vehicle attributes
      if (BladesHelpers.resolveActor(this.actor.system.vehicle) || !trainType.is_vehicle)
        trainTypes.push(trainTypeName);
    for (let usedTrainType of Object.keys(this.actor.system.downtime_activities.train_types))
      trainTypes.splice(trainTypes.indexOf(usedTrainType), 1);
    if (trainTypes.length == 0)
      BladesHelpers.addToRollTypeError(missingRollTypes, 'train', 'SFTD.BadRoll.NoTraining');
    if (!this.actor.system.harm.light.one && !this.actor.system.harm.light.two && !this.actor.system.harm.medium.one && !this.actor.system.harm.medium.two && !this.actor.system.harm.heavy.one && !this.actor.system.harm.deadly.one)
      BladesHelpers.addToRollTypeError(missingRollTypes, 'recover', 'SFTD.BadRoll.NoHarm');
    if (Number(this.actor.system.stress.value) <= 0)
      BladesHelpers.addToRollTypeError(missingRollTypes, 'cutLoose', 'SFTD.BadRoll.NoStress');
    let crewFull = BladesHelpers.resolveActor(this.actor.system.crew);
    if (!crewFull) {
      BladesHelpers.addToRollTypeError(missingRollTypes, 'acquireAsset', 'SFTD.BadRoll.NoCrew');
      BladesHelpers.addToRollTypeError(missingRollTypes, 'collect', 'SFTD.BadRoll.NoCrew');
      BladesHelpers.addToRollTypeError(missingRollTypes, 'longTermProject', 'SFTD.BadRoll.NoCrew');
      BladesHelpers.addToRollTypeError(missingRollTypes, 'manufacture', 'SFTD.BadRoll.NoCrew');
      BladesHelpers.addToRollTypeError(missingRollTypes, 'schmooze', 'SFTD.BadRoll.NoCrew');
      BladesHelpers.addToRollTypeError(missingRollTypes, 'moveBase', 'SFTD.BadRoll.NoCrew');
    } else {
      if (!Object.values(crewFull.system.projects).filter(p => Number(p.clock.value) < Number(p.clock.max)).length)
        BladesHelpers.addToRollTypeError(missingRollTypes, 'longTermProject', 'SFTD.BadRoll.NoOngoingLTP');
      if (!crewFull.system.mobile_base)
        BladesHelpers.addToRollTypeError(missingRollTypes, 'moveBase', 'SFTD.BadRoll.NoMobileBase');
    }
    return [
      rollTypes.filter(r => !Object.keys(missingRollTypes).includes(r)),
      Object.fromEntries(Object.entries(missingRollTypes).map((v, i) => [game.i18n.localize(`SFTD.${v[0][0].toUpperCase() + v[0].slice(1)}Roll`), v[1]]))
    ];
  }
}
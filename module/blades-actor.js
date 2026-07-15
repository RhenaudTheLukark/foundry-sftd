import { bladesRoll, buildRollPopup, resolveRollModifierArray, resolveConditionalModifiers,
  dialogOnFirstRender, dialogOnRender, refreshModifiers, postRollProcessing, pruneInvalidConditionalRollModifiers,
  keepValidModifiersFromOther, computeGroupActionResultAndSendMessage, impactIndex
} from "./blades-roll.js";
import { BladesHelpers } from "./blades-helpers.js";
import { openFormDialog } from "./lib/dialog-compat.js";

/**
 * Extend the basic Actor
 * @extends {Actor}
 */
export class BladesActor extends Actor {

  /** @override */
  static async create(data, options={}) {

    data.prototypeToken = data.prototypeToken || {};

    // For Crew and Strider set the Token to sync with charsheet.
    switch (data.type) {
      case 'strider':
      case 'crew':
      case '\uD83D\uDD5B clock':
      case 'npc':
      case 'faction':
          data.prototypeToken.actorLink = true;
          break;
    }

    return super.create(data, options);
  }

  /** @override */
  getRollData() {
    const rollData = super.getRollData();
    rollData.diceAmount = this.getAttributeDiceToThrow();
    return rollData;
  }

  /**
   * Calculate Attribute Dice to throw.
   */
  getAttributeDiceToThrow() {
    // Calculate Dice to throw.
    let diceAmount = {};
    let attributes = this.getComputedAttributes();

    for (var attributeName in attributes) {
      diceAmount[attributeName] = 0;
      for (var actionName in attributes[attributeName].actions) {
        diceAmount[actionName] = parseInt(attributes[attributeName].actions[actionName]['value']);

        // We add a +1d for every action higher than 0.
        if (diceAmount[actionName] > 0)
          diceAmount[attributeName]++;
      }
    }

    return diceAmount;
  }

  async rollAttributePopup(attributeName, groupActionData) {
    let attributeLabel = BladesHelpers.getRollLabel(attributeName);

    // Fetch roll modifiers
    let [_, allPermanentModifiers, allConditionalModifiers] = this.getModifiers();
    allPermanentModifiers = await resolveRollModifierArray(allPermanentModifiers, this);
    allConditionalModifiers = await resolveRollModifierArray(allConditionalModifiers, this);
    allConditionalModifiers = pruneInvalidConditionalRollModifiers(this, allConditionalModifiers);

    let isAction = BladesHelpers.isAttributeAction(attributeName);
    let title = game.i18n.format(`SFTD.${isAction ? 'Action' : 'Attribute'}RollTitle`, { attribute: game.i18n.localize(groupActionData ? 'SFTD.GroupActionRoll' : attributeLabel) });
    let rollTypes = groupActionData ? ['groupAction'] : isAction ? ['actionRoll'] : ['resistance'];
    let dialog = new foundry.applications.api.DialogV2({
      window: { title: title },
      content: buildRollPopup(title, this, rollTypes, {}, true, {}, {action: attributeName}),
      buttons: [
        {
          icon: "fas fa-check",
          label: game.i18n.localize('SFTD.Roll'),
          action: "roll"
        },
        {
          icon: "fas fa-times",
          label: game.i18n.localize('Close'),
          action: "close"
        },
      ],
      submit: async (result, dialog) => {
        if (result != "roll") return;

        let html = $(dialog.element);
        let extraDice = parseInt(html.find('[name="mod"]')[0].value);
        let note = html.find('[name="note"]')[0].value;
        let actionDiceAmount = this.getRollData().diceAmount[attributeName] + extraDice;

        // Fetch enabled conditional roll modifiers by HTML inspection
        let enabledConditionalModifiers = resolveConditionalModifiers(dialog, this, attributeName);
        enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);

        let input = html.find("input[type=radio]:checked");
        if (input.length > 0) {
          let rollType = input[0].id.split('-')[0];
          let extraFields = { roll_type: rollType, modifiers: [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ], actor: this };
          switch (rollType) {
            case 'groupAction':
              attributeName = html.find('[name="groupActionAction"]')[0].value;
            case 'actionRoll':
              extraFields.dire = this.system.stress.value == this.system.stress.max;
              extraFields.last_stand = this.system.modifiers.last_stand;
              extraFields.group_action = groupActionData;

              let position, forcedPosition, impact, forcedImpact;
              if (groupActionData) {
                position = extraFields.group_action.position;
                forcedPosition = extraFields.group_action.forcedPosition;
                impact = extraFields.group_action.impact;
                forcedImpact = extraFields.group_action.forcedImpact;
              } else {
                position = html.find('[name="pos"]')[0].value;
                forcedPosition = html.find('[name="forcedPos"]')[0].checked;
                impact = html.find('[name="impact"]')[0].value;
                forcedImpact = html.find('[name="forcedImpact"]')[0].checked;
              }
              await this.rollAttribute(attributeName, extraDice, position, forcedPosition, impact, forcedImpact, note, extraFields);
              break;
            case 'resistance':
              if (["expertise", "acuity"].includes(attributeName)) extraFields.noRoll = true;
              extraFields.resistance_attribute = attributeName;
              await bladesRoll(actionDiceAmount, "SFTD.ResistanceRoll", note, extraFields);
              break;
            default:
              ui.notifications.warn(game.i18n.format('SFTD.log.warn.UnknownRollType', { type: rollType }));
          }
          await postRollProcessing(this, extraFields);
        }
      }
    })
    dialog.allPermanentModifiers = allPermanentModifiers;
    dialog.allConditionalModifiers = allConditionalModifiers;
    dialog.attributeName = attributeName;
    dialog.rollTypes = rollTypes;
    dialog._onFirstRender = dialogOnFirstRender;
    dialog._onRender = function(context, options) {
      dialogOnRender(context, options, this);

      // Connection update & Trigger it
      let connectionSelector = this.element.querySelector('.modifier[data-modifier="assist"] select[field="SFTD.Connection"]');
      if (connectionSelector) {
        connectionSelector.addEventListener('change', (event) => {
          let modifierElement = $(connectionSelector).closest(".modifier");
          let connectionSelectElementVal = $(modifierElement).find('span:first-of-type select').val();
          if (!connectionSelectElementVal)
            return;
          let connectionValue = BladesHelpers.fetchConnectionsToActor(this.actor.uuid).find(c => c.uuid == connectionSelectElementVal).clock.value;
          let effectsLabelElement = $(modifierElement).find('span:last-of-type label')[0];
          if (effectsLabelElement)
            effectsLabelElement.innerText = `${game.i18n.localize('SFTD.Effects')} (${game.i18n.format('SFTD.ChooseX', {num: connectionValue})})`;
        });

        var event = new Event('change');
        connectionSelector.dispatchEvent(event);
      }
    };
    dialog.refreshModifiers = refreshModifiers;
    dialog.actor = this;
    dialog.render(true);
  }

  /* -------------------------------------------- */

  async rollAttribute(attributeName = "", additionalDiceAmount = 0, position, forcedPosition, impact, forcedImpact, note, extraFields = {}) {
    let diceAmount = 0;

    if (attributeName !== "")
      diceAmount += this.getRollData().diceAmount[attributeName];
    else
      diceAmount = 1;

    diceAmount += additionalDiceAmount;

    await bladesRoll(diceAmount, attributeName, note, { position: position, forcedPosition: forcedPosition, impact: impact, forcedImpact: forcedImpact, ...extraFields });
  }

  /* -------------------------------------------- */

  /**
   * Creates <options> modifiers for dice roll.
   *
   * @param {int} rs  Min die modifier
   * @param {int} re  Max die modifier
   * @param {int} s   Selected die
   */
  createListOfDiceMods(rs, re, s) {
    var text = ``;
    var i = 0;

    if (s == '')
      s = 0;

    for (i = rs; i <= re; i++)
      text += `<option value="${i}"${i == s ? ' selected' : ''}>${i >= 0 ? '+' : ''}${i}d</option>`;

    return text;
  }

  /* -------------------------------------------- */
  getComputedAttributes() {
    let attributes = this.system.attributes;
    for (const a in attributes)
      for (const s in attributes[a].actions)
        if (attributes[a].actions[s].value <= attributes[a].actions[s].min)
          attributes[a].actions[s].value = attributes[a].actions[s].min;
    return attributes;
  }

  getModifiers(actor) {
    if (!actor) actor = this;
    let modifiersCollection = { modifiers: actor.system.modifiers, roll_modifiers: actor.system.roll_modifiers, conditional_roll_modifiers: actor.system.conditional_roll_modifiers };

    let crewFull = BladesHelpers.resolveActor(actor.system.crew);
    if (crewFull) {
      // Fetch crew-level modifiers applying to the object
      for (let modifierPath of Object.keys(modifiersCollection))
        if (crewFull?.system[modifierPath][actor.type] !== undefined)
          modifiersCollection[modifierPath] = BladesHelpers.mergeAddObjects(modifiersCollection[modifierPath], ['specialist', 'strider'], crewFull.system[modifierPath][actor.type]);

      if (['crew', 'specialist'].includes(actor.type))
        // Fetch strider modifiers
        for (let striderUuid of Object.values(crewFull.system.members).map(e => e.uuid)) {
          let striderFull = BladesHelpers.resolveActor(striderUuid);
          if (striderFull.type != 'strider') continue;
          for (let modifierPath of Object.keys(modifiersCollection))
            if (striderFull.system[modifierPath][actor.type])
              for (let [modifierName, modifierValue] of Object.entries(striderFull.system[modifierPath][actor.type]))
                actor.system[modifierPath][modifierName] = modifierValue;
        }
    }

    return [modifiersCollection.modifiers, modifiersCollection.roll_modifiers, modifiersCollection.conditional_roll_modifiers];
  }

  applyModifiers(sheetData) {
    // Catch unmigrated actor data and apply the Mastery crew ability to attribute maxes
    sheetData.system.attributes = this.getComputedAttributes();

    // Apply all stat changes
    sheetData.system = BladesHelpers.mergeAddObjects(sheetData.system, ['crew'], sheetData.system.modifiers);

    // Sanitize some data (make sure it's kept within its normal bounds)
    sheetData.system.load = Math.max(Math.min(sheetData.system.load, 11), 0);
  }

  /* -------------------------------------------- */

  async createGroupAction(action, position, forcedPosition, impact, forcedImpact, leaderFull, note) {
    let diceAmount = leaderFull.getRollData().diceAmount[action];

    // Leader: Increase impact by 1 level
    let leaderHasLeaderAbility = leaderFull.items.filter(i => i.system.leader).length > 0;
    let numberedImpact = impactIndex.indexOf(impact) + (leaderHasLeaderAbility ? 1 : 0);
    impact = impactIndex[Math.min(Math.max(numberedImpact, 0), 4)];

    this.system.group_action = { action: action, position: position, forcedPosition: forcedPosition, impact: impact, forcedImpact: forcedImpact, leader: leaderFull.uuid, leader_action: diceAmount, note: note, rolls: {} };
    await BladesHelpers.tryUpdate(this, {system: {'==group_action': this.system.group_action}});
  }

  async updateGroupActionRoll(actorId, roll) {
    this.system.group_action.rolls[actorId] = roll;
    await BladesHelpers.tryUpdate(this, {system: {group_action: {"==rolls": this.system.group_action.rolls}}});
  }

  async revealGroupActionResult() {
    if (!this.system.group_action) {
      ui.notifications.error(game.i18n.localize('SFTD.log.error.NoGroupAction'));
      return;
    }
    computeGroupActionResultAndSendMessage(this.system.group_action, this);
  }

  /* -------------------------------------------- */

  getTier(forcedValue) {
    if (this.type != 'crew') return 0;
    return 1 + Math.min(Math.floor((forcedValue ?? this.system.cache.value) / 12), 3);
  }

  /* -------------------------------------------- */

  async removeItem(item) {
    await BladesHelpers.tryDelete(item, this);
  }
}

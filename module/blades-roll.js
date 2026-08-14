import { renderHandlebarsTemplate as renderTemplate } from "./compat.js";
import { openFormDialog } from "./lib/dialog-compat.js";
import { BladesHelpers } from "./blades-helpers.js";
import { SFTDChatMessage } from "./messages/sftd-chat-message.js";

export const bladesRollModifierList = {
  level_one_harm: {
    name: 'SFTD.LevelOneHarm',
    nameArgs: {},
    rollTypes: ['actionRoll', 'groupAction'],
    effect: -1
  },
  level_two_harm: {
    name: 'SFTD.LevelTwoHarm',
    nameArgs: {},
    rollTypes: ['actionRoll', 'groupAction'],
    dice: -1
  },
  level_two_harm_relentless: {
    name: 'SFTD.LevelTwoHarm',
    nameArgs: {},
    rollTypes: ['actionRoll', 'groupAction'],
    effect: -1
  },
  level_three_harm_relentless: {
    name: 'SFTD.LevelThreeHarm',
    nameArgs: {},
    rollTypes: ['actionRoll', 'groupAction'],
    dice: -1
  },
  lotus_bargain: {
    name: 'SFTD.LotusBargainTitle',
    notRollTypes: ['recover', 'train'],
    dice: 1,
    rollText: 'SFTD.LotusBargainEffect'
  },
  push_yourself: {
    name: 'SFTD.PushYourself',
    rollTypes: ['actionRoll', 'groupAction', 'fortune'],
    fields: {
      'SFTD.Cost': [],
      'SFTD.Usage': [],
      'SFTD.Effect': ['SFTD.ExtraDie', 'SFTD.ImprovedImpact', 'SFTD.IgnoreHarm']
    },
    resolveFunc: (fields, extraData) => {
      const crewFull = extraData.actorFull.type == 'crew' ? extraData.actorFull : BladesHelpers.resolveActor(extraData.actorFull.system.crew);
      const hasCharmsync = crewFull ? crewFull.system.charmsync_push_yourself_owners?.length > 0 : extraData.actorFull.system.charmsync;
      const charmsyncActive = hasCharmsync && extraData.modifiers.find(m => m.assist) && extraData.modifiers.find(m => m.key == 'charmsync_push_yourself');

      const costType = (fields['SFTD.Cost'] ?? 'SFTD.Stress').slice(5);
      const costTextKey = `SFTD.PushYourself${costType}Cost`;
      const stress = costType != 'Stress' ? 0 : charmsyncActive ? 1 : 2;
      const usageKey = fields['SFTD.Usage'] == 'SFTD.None' ? 'SFTD.PushYourselfUnknownMelodyUsage' : `${(fields['SFTD.Usage'] ?? '.Key').slice(0, -4)}.Description`;

      return {
        stress: stress,
        dice: fields['SFTD.Effect'] == 'SFTD.ExtraDie' ? 1 : 0,
        impact: fields['SFTD.Effect'] == 'SFTD.ImprovedImpact' ? 1 : 0,
        useMelody: costType == 'Melody' ? -1 : undefined,
        rollText: 'SFTD.PushYourselfEffect',
        rollTextArgs: {
          effect: game.i18n.localize(`${fields['SFTD.Effect']}Effect`),
          cost: game.i18n.format(costTextKey, {
            stress: stress,
            charmsyncText: charmsyncActive ? game.i18n.localize('SFTD.PushYourselfCharmsync') : '',
            usage: game.i18n.localize(usageKey)
          })
        },
        pushYourself: true
      };
    },
    push_yourself: true
  },
  harmony: {
    name: 'SFTD.Harmony',
    notRollTypes: ['recover', 'train'],
    dice: 1,
    harmony: -1,
    rollText: 'SFTD.HarmonyEffect',
    isHarmony: true
  },
  assist: {
    name: 'SFTD.Assist',
    rollTypes: ['actionRoll', 'resistance', 'fortune', 'collectInfo', 'engagement'],
    fields: {
      'SFTD.Crewmate': [],
      'SFTD.NotAProblem': false
    },
    resolveFunc: (fields, extraData) => {
      let assistFull = BladesHelpers.resolveActor(fields['SFTD.Crewmate']);
      let otherStress = {};
      let otherValue = {};
      if (!fields['SFTD.NotAProblem'])
        otherStress[assistFull.uuid] = 1;
      else
        otherValue[assistFull.uuid] = {'system.not_a_problem_uses.value': -1};
      return {
        dice: 1,
        otherStress: otherStress,
        otherValue: otherValue,
        rollText: `SFTD.Assist${fields['SFTD.NotAProblem'] ? 'NotAProblem' : ''}Effect`,
        rollTextArgs: { strider: assistFull ? assistFull.name : 'Unknown Strider' },
        allowHarmonyGain: true
      };
    },
    assist: true
  },
  setting_up: {
    name: 'SFTD.SettingUp',
    rollType: 'actionRoll',
    allowHarmonyGain: true,
    rollText: 'SFTD.SettingUpEffect'
  },
  setup: {
    name: 'SFTD.Setup',
    rollType: 'actionRoll',
    fields: {
      'SFTD.Crewmate': [],
      'SFTD.Effect': ['SFTD.Position', 'SFTD.Impact']
    },
    resolveFunc: (fields) => {
      const setupGiverFull = BladesHelpers.resolveActor(fields['SFTD.Crewmate']);
      const isImpact = fields['SFTD.Effect'] != 'SFTD.Position';
      const isPosition = fields['SFTD.Effect'] != 'SFTD.Impact';
      const effectText = fields['SFTD.Effect'] == 'SFTD.BothCharmsync' ? 'SFTD.PositionAndImpact' : fields['SFTD.Effect'];
      return {
        impact: isImpact ? 1 : 0,
        position: isPosition ? 1 : 0,
        allowHarmonyGain: true,
        rollText: 'SFTD.SetupEffect',
        rollTextArgs: { strider: setupGiverFull ? setupGiverFull.name : 'Unknown Strider', effect: game.i18n.localize(effectText) } };
    },
    setup: true
  },
  protect: {
    name: 'SFTD.ProtectTitle',
    rollType: 'resistance',
    fields: {
      'SFTD.Crewmate': []
    },
    resolveFunc: (fields, extraData) => {
      let protecteeFull = BladesHelpers.resolveActor(fields['SFTD.Crewmate']);
      let protecteeName = fields['SFTD.Crewmate'] == '' ? game.i18n.localize('SFTD.ProtectEffectOther') : protecteeFull ? protecteeFull.name : 'Unknown Strider';
      return {
        allowHarmonyGain: true,
        rollText: 'SFTD.ProtectEffect',
        rollTextArgs: { strider: protecteeName },
        protect: true
      };
    },
    protect: true
  },
  alloyed_mettle: {
    name: 'SFTD.StriderAbility.AlloyedMettle.Title',
    rollType: 'actionRoll',
    impact: 1
  },
  flow_and_crash_action: {
    name: 'SFTD.StriderAbility.FlowAndCrash.Title',
    rollTypes: ['actionRoll', 'groupAction'],
    dice: 1
  },
  intercepting_fist_collect_info: {
    name: 'SFTD.StriderAbility.InterceptingFist.CollectInfoTitle',
    rollType: 'collectInfo',
    impact: 1
  },
  intercepting_fist_resistance: {
    hidden: true,
    rollType: 'resistance',
    needProtect: true,
    dice: 1
  },
  spark_of_hope: {
    name: 'SFTD.StriderAbility.SparkOfHope.Title',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeNames: ['command', 'connect'],
    dice: 1
  },
  friendly_face_action: {
    name: 'SFTD.StriderAbility.FriendlyFace.ActionTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    dice: 1
  },
  friendly_face_collect_info: {
    name: 'SFTD.StriderAbility.FriendlyFace.CollectInfoTitle',
    rollType: 'collectInfo',
    dice: 1
  },
  friendly_face_reduce_pressure: {
    rollType: 'reducePressure',
    dice: 1
  },
  night_market: {
    name: 'SFTD.StriderAbility.NightMarket.Title',
    rollType: 'reducePressure',
    itemNeeded: 'night_market',
    bonusRoll: true,
    rollText: 'SFTD.StriderAbility.NightMarket.Description'
  },
  stand_up_talk_down: {
    name: 'SFTD.StriderAbility.StandUpTalkDown.Title',
    rollTypes: ['actionRoll', 'groupAction'],
    needHarmony: true,
    rollText: 'SFTD.StriderAbility.StandUpTalkDown.Description'
  },
  strictly_speaking: {
    name: 'SFTD.StriderAbility.StrictlySpeaking.Title',
    rollTypes: ['actionRoll', 'groupAction'],
    attributeName: 'bluff',
    dice: 1
  },
  threads_of_fate: {
    name: 'SFTD.StriderAbility.ThreadsOfFate.Title',
    rollTypes: ['actionRoll', 'groupAction'],
    dice: 1
  },
  charmsync_push_yourself: {
    name: 'SFTD.StriderAbility.Charmsync.ActionTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    needPushYourself: true,
    exclude: true
  },
  charmsync_resistance: {
    name: 'SFTD.StriderAbility.Charmsync.ResistanceTitle',
    rollType: 'resistance',
    needProtect: true,
    rollText: 'SFTD.StriderAbility.Charmsync.ResistanceDescription',
    exclude: true
  },
  long_thought: {
    name: 'SFTD.StriderAbility.LongThought.Title',
    rollTypes: ['actionRoll', 'groupAction'],
    impact: 1,
    exclude: true
  },
  storm_warning: {
    name: 'SFTD.StriderAbility.StormWarning.Title',
    rollTypes: ['actionRoll', 'groupAction'],
    dice: 1
  },
  way_of_the_seeker_collect_info: {
    name: 'SFTD.StriderAbility.WayOfTheSeeker.CollectInfoTitle',
    rollType: 'collectInfo',
    impact: 1
  },
  way_of_the_seeker_action: {
    name: 'SFTD.StriderAbility.WayOfTheSeeker.ActionTitle',
    rollTypes: ['actionRoll', 'groupAction'],
    dice: 1
  },
  backchatter_network: {
    name: 'SFTD.CrewFoundation.BackchatterNetwork.Title',
    rollType: 'collectInfo',
    dice: 1
  }
}

export const positionIndex = ['desperate', 'risky', 'controlled'];
export const impactIndex = ['zero', 'weak', 'normal', 'strong', 'extreme'];

/**
 * Roll Dice.
 * @param {int} diceAmount
 * @param {string} attributeOrRollName
 * @param {string} note
 * @param {Object} extraFields
 */
export async function bladesRoll(diceAmount, attributeOrRollName = '', note = '', extraFields = {}) {
  if (attributeOrRollName.includes('SpecialistRoll') && !extraFields.within_expertise) diceAmount = 0;

  let numberedPosition = positionIndex.indexOf(extraFields.position);
  let numberedImpact = impactIndex.indexOf(extraFields.impact);

  let rollData = extraFields.rollData ?? {modifiers: foundry.utils.deepClone(extraFields.modifiers), note: note};

  let stressChanges = {};
  stressChanges[extraFields.actor?.uuid] = 0;

  let crewFull = BladesHelpers.resolveActor(extraFields.actor?.system.crew);
  let factionFull = BladesHelpers.resolveActor(crewFull?.system.faction);
  let shellChanges = extraFields.shells ?? 0;
  let rollTypeKey = Object.entries(rollTypeLabels).find(r => r[1] == attributeOrRollName);
  let otherChanges = {};
  let downtimeCountChanges = rollTypeKey ? (BladesHelpers.isDowntime(rollTypeKey[0]) ? -1 : 0) : 0;

  let allowHarmonyGain = false;
  let useMelody = false;
  let harmonyChanges = 0;

  // Add modifiers effects to the roll/actor
  for (let modifier of extraFields.modifiers) {
    if (modifier.dice) diceAmount += modifier.dice;
    if (modifier.position && extraFields.position) numberedPosition += modifier.position;
    if (modifier.impact && extraFields.impact) numberedImpact += modifier.impact;
    if (modifier.stress) stressChanges[extraFields.actor?.uuid] = Number(modifier.stress);
    if (modifier.otherStress)
      for (let [uuid, value] of Object.entries(modifier.otherStress))
        stressChanges[uuid] = (stressChanges[uuid] ?? 0) + Number(value);
    if (modifier.shells) shellChanges += modifier.shells;
    if (modifier.useMelody) useMelody = true;
    if (modifier.bonusRoll) {
      downtimeCountChanges = 0;
      extraFields.bonusRoll = true;
    }
    if (modifier.otherValue)
      for (let [uuid, value] of Object.entries(modifier.otherValue))
        otherChanges[uuid] = otherChanges[uuid] ? BladesHelpers.mergeAddObjects(otherChanges[uuid], [], value) : value;
    if (modifier.downtime) downtimeCountChanges += modifier.downtime;
    if (modifier.convictionCutLoose) extraFields.conviction = true;
    if (modifier.workHardPlayHard) extraFields.workHardPlayHard = true;
    if (modifier.harmony) harmonyChanges += modifier.harmony;
    if (modifier.allowHarmonyGain) allowHarmonyGain = true;
  }

  // Stress Changes
  if (rollData.stressChanges)
    rollData.oldStressChanges = rollData.stressChanges;
  rollData.stressChanges = {};
  for (let [stressActorUuid, stressChange] of Object.entries(stressChanges)) {
    let stressChangeItem = {value: stressChange, realValue: stressChange};
    let stressActorFull = BladesHelpers.resolveActor(stressActorUuid);
    if (stressChange != 0 && stressActorFull?.system.stress?.value != undefined) {
      let resultStress = Math.max(Math.min(Number(stressActorFull.system.stress.value) + stressChange, stressActorFull.system.stress.max), 0);
      stressChangeItem.realValue = resultStress - Number(stressActorFull.system.stress.value);
      if (resultStress != stressActorFull.system.stress.value)
        await BladesHelpers.tryUpdate(stressActorFull, {system: {stress: {'==value': resultStress}}});
      rollData.stressChanges[stressActorFull._id] = stressChangeItem;
    }
  }

  // Shell Changes
  extraFields.shells = shellChanges;
  if (extraFields.shells != 0)
    rollData.shells = shellChanges;
  let crewUpdateObject = {system: {}};
  if (shellChanges) {
    crewUpdateObject.system.shells = {'==value': Math.min(Math.max(Number(crewFull.system.shells.value) + shellChanges, 0), Number(crewFull.system.shells.max))};
    rollData.realShells = crewUpdateObject.system.shells - Number(crewFull.system.shells.value);
  }
  // Harmony Changes
  extraFields.harmony = harmonyChanges;
  if (extraFields.harmony != 0)
    rollData.harmony = harmonyChanges;
  if (harmonyChanges) {
    crewUpdateObject.system.harmony = {'==value': Math.min(Math.max(Number(crewFull.system.harmony.value) + harmonyChanges, 0), Number(crewFull.system.harmony.max))};
    rollData.realHarmony = crewUpdateObject.system.harmony - Number(crewFull.system.harmony.value);
  }
  if (Object.keys(crewUpdateObject.system).length)
    await BladesHelpers.tryUpdate(crewFull, crewUpdateObject);

  // Other Changes
  if (rollData.otherChanges)
    rollData.oldOtherChanges = rollData.otherChanges;
  rollData.otherChanges = {};
  for (let [otherActorUuid, otherChangeObj] of Object.entries(otherChanges)) {
    if (Object.values(otherChangeObj).length == 0) continue;
    let otherActorFull = BladesHelpers.resolveActor(otherActorUuid);
    if (otherActorFull) {
      let otherChangeItem = {value: {}, realValue: {}};
      let updateObject = {};
      for (let [otherPath, otherChange] of Object.entries(otherChangeObj)) {
        let otherValue = otherActorFull;
        for (let pathPart of otherPath.split('.')) {
          if (!otherValue)
            break;
          otherValue = otherValue[pathPart];
        }
        let resultOther = Math.max(Number(otherValue) + otherChange, 0);
        let updatePath = otherPath.split('.');
        updatePath[updatePath.length - 1] = '==' + updatePath[updatePath.length - 1];
        updatePath = updatePath.join('.');
        updateObject[updatePath] = resultOther;
        otherChangeItem.realValue[otherPath] = resultOther - Number(otherValue);
      }
      await BladesHelpers.tryUpdate(otherActorFull, updateObject);
      rollData.otherChanges[otherActorFull._id] = otherChangeItem;
    }
  }

  // Update the main actor in case of no further data update
  if (extraFields.actor) {
    let actorUpdateObject = {};
    if (extraFields.actor.type == 'strider') {
      let downtimeShift = Math.max(extraFields.actor.system.downtime_count.value + downtimeCountChanges, 0);
      actorUpdateObject['system.downtime_count.==value'] = downtimeShift;
      if (downtimeCountChanges < 0) {
        let rollTypeString = Object.entries(rollTypeLabels).find(l => l[1] == attributeOrRollName)[0];
        actorUpdateObject[`system.downtime_activities.==${rollTypeString}`] = true;
        rollData.downtime = {value: downtimeShift, activities: {train_types: {}}};
        if (!extraFields.actor.system.downtime_activities[rollTypeString])
          rollData.downtime.activities[rollTypeString] = true;
        if (attributeOrRollName == 'SFTD.TrainRoll') {
          actorUpdateObject[`system.downtime_activities.train_types.==${extraFields.trainType}`] = true;
          if (!extraFields.actor.system.downtime_activities.train_types[extraFields.trainType])
            rollData.downtime.activities.train_types[extraFields.trainType] = true;
        }
      }

      // Melody Changes
      extraFields.melody = useMelody && extraFields.actor.system.melody;
      if (extraFields.melody) {
        rollData.melody = true;
        actorUpdateObject['system.==melody'] = false;
      }
    } else
      actorUpdateObject = {'==name': extraFields.actor.name};
    await BladesHelpers.tryUpdate(extraFields.actor, actorUpdateObject);
  }

  // Only apply modified position and impact if they haven't been forced
  if (extraFields.position && !extraFields.forcedPosition) extraFields.position = positionIndex[Math.min(Math.max(numberedPosition, 0), 2)];
  if (extraFields.impact && !extraFields.forcedImpact) extraFields.impact = impactIndex[Math.min(Math.max(numberedImpact, 0), 4)];

  extraFields.allowHarmonyGain = allowHarmonyGain || numberedPosition == 0 || (extraFields.actor?.system.seventh_sense && numberedPosition == 1);
  extraFields.rollData = rollData;

  if (!extraFields.noRoll) {
    let zeromode = false;
    if (diceAmount < 0) diceAmount = 0;
    if (diceAmount === 0) {
      zeromode = true;
      diceAmount = 2;
    }

    let r;
    if (extraFields.rollData.rolls)
      r = extraFields.rollData.rolls;
    else {
      r = new Roll(`${diceAmount}d6`, {});
      // show 3d Dice so Nice if enabled
      await r.evaluate();
    }

    await showChatRollMessage(r, zeromode, attributeOrRollName, note, extraFields);
  } else
    await showChatMessage(diceAmount, attributeOrRollName, note, extraFields);
}

/**
 * Shows Chat message related to rolls.
 *
 * @param {Roll} r
 * @param {Boolean} zeromode
 * @param {String} attributeOrRollName
 * @param {string} note
 * @param {Object} extrafields
 */
async function showChatRollMessage(r, zeromode, attributeOrRollName, note, extraFields) {
  let speaker = ChatMessage.getSpeaker();
  if (extraFields.actor)
    speaker = {
      actor: extraFields.actor._id,
      alias: extraFields.actor.name,
      scene: null,
      token: extraFields.actor.prototypeToken?._id
    };

  let attributeLabel = BladesHelpers.getRollLabel(attributeOrRollName);

  // Retrieve Roll status
  let rolls = (r.terms)[0].results;
  let [rollStatus, resultDie, extraResult] = getBladesRollStatus(rolls, zeromode, extraFields.modifiers);
  if (extraFields.forcedResult)
    rollStatus = extraFields.forcedResult;

  let crewFull = BladesHelpers.resolveActor(extraFields.actor?.system.crew);
  if (crewFull && extraFields.allowHarmonyGain && rollResultIndex.indexOf(rollStatus) >= 2) {
    let newHarmony = Math.max(Math.min(crewFull.system.harmony.value + 1, crewFull.system.harmony.max), 0);
    await BladesHelpers.tryUpdate(crewFull, {'system.harmony.value': newHarmony});
    extraFields.modifier_text = `${extraFields.modifier_text ?? ''}<p>${game.i18n.localize('SFTD.HarmonyGained')}</p>`;
  }

  if (!extraFields.rollData)
    extraFields.rollData = {};
  extraFields.rollData.rolls = r;

  // Only keep valid modifiers with the given dice result
  extraFields.modifiers = keepValidModifiersFromStatus(extraFields.modifiers, rollStatus);

  // Check and log if Dice Configuration is Manual
  let method = {};
  method.type = (r.terms)[0].method;
  if (method.type) {
    method.icon = CONFIG.Dice.fulfillment.methods[method.type].icon;
    method.label = CONFIG.Dice.fulfillment.methods[method.type].label;
  }

  // Compute extra text from modifiers
  extraFields.modifier_text = (extraFields.modifier_text ?? '') + computeModifierMessages(extraFields.modifiers);

  let result;
  // TODO: Extend rollData to all roll types
  // Check for Specialist rolls
  if (attributeOrRollName == 'SFTD.SpecialistRoll') {
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/specialist-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, note: note, extraFields: extraFields });
  // Check for Group Specialist rolls
  } else if (attributeOrRollName == 'SFTD.GroupSpecialistRoll') {
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/group-specialist-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: attributeLabel, note: note, extraFields: extraFields });
    let crewFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    crewFull?.updateGroupActionRoll(extraFields.actor.id, rollStatus);
  // Check for Group Action roll
  } else if (extraFields.group_action) {
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/group-action-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: attributeLabel, note: note, extraFields: extraFields });
    // Dire Action
    if (extraFields.dire && rollStatus == 'critical-success')
      await BladesHelpers.tryUpdate(extraFields.actor, {system: {stress: {'==value': Math.max(Number(extraFields.actor.system.stress.value) - 1, 0)}}});

    let crewFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    crewFull?.updateGroupActionRoll(extraFields.actor.id, rollStatus);
  }
  // Check for Action roll
  else if (BladesHelpers.isAttributeAction(attributeOrRollName)) {
    let positionLocalize = '';
    switch (extraFields.position) {
      case 'controlled':
        positionLocalize = 'SFTD.PositionControlled'
        break;
      case 'desperate':
        positionLocalize = 'SFTD.PositionDesperate'
        break;
      case 'risky':
      default:
        positionLocalize = 'SFTD.PositionRisky'
    }

    let impactLocalize = '';
    switch (extraFields.impact) {
      case 'zero':
        impactLocalize = 'SFTD.ImpactZero'
        break;
      case 'weak':
        impactLocalize = 'SFTD.ImpactWeak'
        break;
      case 'strong':
        impactLocalize = 'SFTD.ImpactStrong'
        break;
      case 'extreme':
        impactLocalize = 'SFTD.ImpactExtreme'
        break;
      case 'normal':
      default:
        impactLocalize = 'SFTD.ImpactNormal'
    }
    // Dire Action
    if (extraFields.dire && rollStatus == 'critical-success')
      await BladesHelpers.tryUpdate(extraFields.actor, {system: {stress: {'==value': Math.max(Number(extraFields.actor.system.stress.value) - 1, 0)}}});

    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/action-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: attributeLabel, position_localize: positionLocalize, impact_localize: impactLocalize, note: note, extraFields: extraFields });
  }
  // Check for Resistance roll
  else if (attributeOrRollName == 'SFTD.ResistanceRoll') {
    let stress = getBladesRollResistanceStress(rolls, extraResult, zeromode);
    let resultStress = Math.max(Math.min(Number(extraFields.actor.system.stress.value) + stress, Number(extraFields.actor.system.stress.max)), 0);
    if (resultStress != extraFields.actor.system.stress.value)
      await BladesHelpers.tryUpdate(extraFields.actor, {system: {stress: {'==value': resultStress}}});
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/resistance-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: attributeLabel, stress: stress, note: note, extraFields: extraFields });
  }
  // Check for Aftermath roll
  else if (attributeOrRollName == 'SFTD.AftermathRoll') {
    let crewFull = extraFields.actor?.type == 'crew' ? extraFields.actor : BladesHelpers.resolveActor(extraFields.actor?.system.crew);
    extraFields.cantHateUs = crewFull?.system.cant_hate_us;
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/aftermath-roll.html', { rolls: rolls, zeromode: zeromode, method: method, resultDie: resultDie, note: note, extraFields: extraFields });
  }
  // Check for Collect Information roll
  else if (attributeOrRollName == 'SFTD.CollectInformationRoll') {
    let positionLocalize = '';
    switch (extraFields.position) {
      case 'controlled':
        positionLocalize = 'SFTD.PositionControlled'
        break;
      case 'desperate':
        positionLocalize = 'SFTD.PositionDesperate'
        break;
      case 'risky':
      default:
        positionLocalize = 'SFTD.PositionRisky'
    }

    let impactLocalize = '';
    switch (extraFields.impact) {
      case 'zero':
      case 'weak':
        impactLocalize = 'SFTD.ImpactWeak'
        break;
      case 'strong':
      case 'extreme':
        impactLocalize = 'SFTD.ImpactStrong'
        break;
      case 'normal':
      default:
        impactLocalize = 'SFTD.ImpactNormal'
    }
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/collect-info-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: attributeLabel, position_localize: positionLocalize, impact_localize: impactLocalize, note: note, extraFields: extraFields });
  }
  // Check for Engagement roll
  else if (attributeOrRollName == 'SFTD.EngagementRoll')
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/engagement-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: attributeLabel, note: note, extraFields: extraFields });
  // Check for Upkeep roll
  else if (attributeOrRollName == 'SFTD.UpkeepRoll') {
    let shells = getBladesRollCollect(rolls, extraResult, zeromode);
    let crewFull = extraFields.actor?.type == 'crew' ? extraFields.actor : BladesHelpers.resolveActor(extraFields.actor?.system.crew);
    let overShells = 0;
    if (crewFull) {
      let newShells = Math.min(crewFull.system.shells.value + shells, crewFull.system.shells.max);
      overShells = crewFull.system.shells.value + shells - newShells;
      await BladesHelpers.tryUpdate(crewFull, {'system.shells.value': newShells});
    }
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/upkeep-roll.html', { rolls: rolls, zeromode: zeromode, method: method, num: shells, overShells: overShells, note: note, extraFields: extraFields });
  }

  // Check for Acquire Asset roll
  else if (attributeOrRollName == 'SFTD.ConstructFoundationRoll') {
    let crewFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    let crewUpdateObject = {system: {projects: {}}};
    let tick = getBladesRollDowntime(rolls, extraResult, zeromode);
    let baseTick = tick;
    let tickRemainder;

    let project = crewFull.system.projects[extraFields.cfId];
    let newTick = Math.min(project.clock.value + tick, project.clock.max);
    let clockFilled = newTick >= project.clock.max;
    if (clockFilled)
      tick = project.clock.max - project.clock.value;
    crewUpdateObject.system.projects[extraFields.cfId] = {clock: {'==value': newTick}};
    await BladesHelpers.tryUpdate(crewFull, crewUpdateObject);
    if (clockFilled) {
      // TODO: Actually add the Foundation
    }

    let improvementLevels = ['critical-success', 'success', 'partial-success', 'failure'];
    extraFields.improvementLevels = improvementLevels.indexOf(rollStatus);
    extraFields.foundation = project.title;
    extraFields.isFoundationUpgrade = project.is_foundation_upgrade;
    extraFields.clockFilled = clockFilled;

    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/downtime/construct-foundation-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, tick: tick, note: note, extraFields: extraFields });
  }
  // Check for Cut Loose roll
  else if (attributeOrRollName == 'SFTD.CutLooseRoll') {
    let clearStress = getBladesRollCutLooseUnwind(rolls, extraResult, zeromode);
    let realClearStress = clearStress;
    let remainingStress = extraFields.actor.system.stress.value - clearStress;
    if (!extraFields.forcedResult)
      rollStatus = remainingStress >= 0 ? 'success' : 'failure';
    if (remainingStress < 0) {
      remainingStress = 0;
      clearStress = extraFields.actor.system.stress.value;
    }

    let crewFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    crewFull.updateCutLooseRoll(extraFields.actor.id, rollStatus, clearStress);

    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/downtime/cut-loose-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, stress: clearStress, note: note, extraFields: extraFields });
  }
  // Check for Long-Term Project roll
  else if (attributeOrRollName == 'SFTD.LongTermProjectRoll') {
    let crewFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    let crewUpdateObject = {system: {projects: {}}};
    let tick = getBladesRollDowntime(rolls, extraResult, zeromode);
    let baseTick = tick;
    let tickRemainder;

    let project = crewFull.system.projects[extraFields.ltpId];
    let newTick = Math.min(Number(project.clock.value) + tick, Number(project.clock.max));
    let clockFilled = newTick >= Number(project.clock.max);
    if (clockFilled)
      tick = Number(project.clock.max) - Number(project.clock.value);
    crewUpdateObject.system.projects[extraFields.ltpId] = {clock: {'==value': newTick}};
    await BladesHelpers.tryUpdate(crewFull, crewUpdateObject);

    let improvementLevels = ['critical-success', 'success', 'partial-success', 'failure'];
    extraFields.improvementLevels = improvementLevels.indexOf(rollStatus);
    extraFields.project = project.title;
    extraFields.clockFilled = clockFilled;
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/downtime/long-term-project-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, tick: tick, note: note, extraFields: extraFields });
  }
  // Check for Manufacture roll
  else if (attributeOrRollName == 'SFTD.ManufactureRoll') {
    let successTier = Number(extraFields.successTier);
    let tierQuality = Number(extraFields.tier);
    let origTierQuality = tierQuality;
    switch (rollStatus) {
      case 'critical-success':
        tierQuality = tierQuality + 2;
        break;
      case 'success':
        tierQuality = tierQuality + 1;
        break;
      case 'failure':
        if (tierQuality > 0)
          tierQuality = tierQuality - 1;
        break;
      default:
        break;
    }
    let shellsNeededForSuccess = Math.max(successTier - tierQuality, 0);
    let successRollStatus = shellsNeededForSuccess > 0 ? 'failure' : 'success';
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/downtime/manufacture-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, success_roll_status: successRollStatus, attribute_label: attributeLabel, tier_quality: tierQuality, success_tier: successTier, success_shells: shellsNeededForSuccess, note: note, extraFields: extraFields });
  }
  // Check for Reduce Pressure roll
  else if (attributeOrRollName == 'SFTD.ReducePressureRoll') {
    let crewFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    let ticks = getBladesRollDowntime(rolls, extraResult, zeromode);
    let crewUpdateObject = {'system.pressure.==value': Math.max(crewFull.system.pressure.value - ticks, 0)};

    let hazardFull = false;
    if (extraFields.rpHazard) {
      let newTick = Math.min(crewFull.system.hazard.reduction.value + ticks, crewFull.system.hazard.reduction.max);
      hazardFull = newTick == crewFull.system.hazard.reduction.max;
      if (hazardFull)
        crewUpdateObject['system.hazard.==value'] = crewFull.system.hazard.value - 1;
      crewUpdateObject['system.hazard.reduction.==value'] = newTick % crewFull.system.hazard.reduction.max;
    }
    await BladesHelpers.tryUpdate(crewFull, crewUpdateObject);

    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/downtime/reduce-pressure-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, tick: ticks, hazard_full: hazardFull, note: note, extraFields: extraFields });
  }
  // Check for Unwind roll
  else if (attributeOrRollName == 'SFTD.UnwindRoll') {
    let clearStress = getBladesRollCutLooseUnwind(rolls, extraResult, zeromode);
    let realClearStress = clearStress;
    let remainingStress = extraFields.actor.system.stress.value - clearStress;
    if (!extraFields.forcedResult)
      rollStatus = remainingStress >= 0 ? 'success' : 'failure';
    if (remainingStress < 0) {
      remainingStress = 0;
      clearStress = extraFields.actor.system.stress.value;
    }

    let beliefFullText = '';
    let updateObject = {'system.stress.==value': remainingStress };
    updateObject['system.belief.clock.==value'] = (extraFields.actor.system.belief.clock.value + 1) % extraFields.actor.system.belief.clock.max;
    if (updateObject['system.belief.clock.==value'] < extraFields.actor.system.belief.clock.value)
      beliefFullText = game.i18n.localize('SFTD.RollUnwindBeliefFull');
    await BladesHelpers.tryUpdate(extraFields.actor, updateObject);

    let unwindNPCName = '';
    if (extraFields.unwindNPC == 'other')      unwindNPCName = game.i18n.localize('SFTD.RollUnwingOther');
    else if (extraFields.unwindNPC == 'group') unwindNPCName = game.i18n.localize('SFTD.RollUnwingGroup');
    else {
      let unwindNPCFull = BladesHelpers.resolveActor(extraFields.unwindNPC);
      unwindNPCName = unwindNPCFull?.name ?? 'Unknown NPC';
    }

    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/downtime/unwind-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, npc: unwindNPCName, stress: clearStress, belief_full_text: beliefFullText, note: note, extraFields: extraFields });
  }
  // Check for Fortune Roll
  else if (attributeOrRollName == 'SFTD.FortuneRoll')
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/fortune-roll.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, attribute_label: 'SFTD.FortuneRoll', note: note, extraFields: extraFields });
  // Generic roll if not specified
  else {
    // Collection Agency & Side Business: Update Shells
    if (['SFTD.CollectionAgency', 'SFTD.SideBusiness'].includes(attributeOrRollName)) {
      let factionRelationships = Object.values(extraFields.actor.system.relationships).map(r => { return {actor: BladesHelpers.resolveActor(r.uuid), status: r.status}; }).filter(r => r.actor && r.actor.type == 'faction');
      let minRelationship = factionRelationships.length > 0 ? Math.min(factionRelationships.map(r => Number(r.status)).sort()[0], 0) : 0;
      let value = Math.max(resultDie + minRelationship, 0);
      extraFields.contents = game.i18n.format(extraFields.contents, {value: value});

      let updateObject = {'system.shells.value': Math.min(Math.max(Number(extraFields.actor.system.shells.value) + value, 0), Number(extraFields.actor.system.shells.max))};
      await BladesHelpers.tryUpdate(extraFields.actor, updateObject);
    }
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/generic-message.html', { rolls: rolls, zeromode: zeromode, method: method, roll_status: rollStatus, note: note, extraFields: extraFields });
  }

  let messageData = {
    speaker: speaker,
    content: result,
    rollData: extraFields.rollData,
    rolls: [r]
  }
  await SFTDChatMessage.create(messageData);
}

/**
 * Shows Chat message.
 *
 * @param {String} attributeOrRollName
 * @param {string} position
 * @param {string} note
 * @param {Object} extraFields
 */
async function showChatMessage(dice, attributeOrRollName = '', note = '', extraFields = {}) {
  let speaker = ChatMessage.getSpeaker();
  if (extraFields.actor)
    speaker = {
      actor: extraFields.actor._id,
      alias: extraFields.actor.name,
      scene: null,
      token: extraFields.actor.prototypeToken?._id
    };

  let attribute_label = BladesHelpers.getRollLabel(attributeOrRollName);

  // Compute extra text from modifiers
  extraFields.modifier_text = (extraFields.modifier_text ?? '') + computeModifierMessages(extraFields.modifiers);

  let result;
  if (attributeOrRollName == 'SFTD.CutLooseBeginRoll') {
    const crewFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    await crewFull.createCutLoose(extraFields.actor, note);
    const speaker = {
      actor: crewFull._id,
      alias: crewFull.name,
      scene: null,
      token: crewFull.prototypeToken._id
    };
    const messageData = {
      speaker: speaker,
      cutLooseCrew: crewFull.uuid,
      content: await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/downtime/cut-loose-begin.html', { leader: extraFields.actor, note: note })
    }
    await SFTDChatMessage.create(messageData);
    return;
  }
  // Check for Recover
  else if (attributeOrRollName == 'SFTD.RecoverRoll') {
    let levelOneHarm = extraFields.actor.system.harm.light.one != '' || extraFields.actor.system.harm.light.two != '';

    // Reduce all Harm by one level
    let updateObject = {};
    let harmLevels = ['', 'light', 'medium', 'heavy', 'deadly'];
    for (let [harmId, harmLevel] of Object.entries(harmLevels)) {
      if (harmId == 0) continue;
      let sourceHarmId = Number(harmId) + 1;
      let sourceHarmLevel = sourceHarmId >= harmLevels.length ? '' : harmLevels[sourceHarmId];
      updateObject[`system.harm.${harmLevel}.one`] = sourceHarmLevel != '' ? extraFields.actor.system.harm[sourceHarmLevel].one : '';
      if (harmId <= 2)
        updateObject[`system.harm.${harmLevel}.two`] = (sourceHarmLevel != '' && sourceHarmId <= 2) ? extraFields.actor.system.harm[sourceHarmLevel].two : '';
    }
    await BladesHelpers.tryUpdate(extraFields.actor, updateObject);

    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/downtime/recover-get.html', { levelOneHarm: levelOneHarm, note: note, extraFields: extraFields });
  }
  // Check for Train
  else if (attributeOrRollName == 'SFTD.TrainRoll') {
    let crewFull = BladesHelpers.resolveActor(extraFields.actor.system.crew);
    let xpGain = extraFields.actor.system.xp_gain[extraFields.trainType] + (crewFull?.system.modifiers.strider?.xp_gain?.[extraFields.trainType] ?? 0);
    let xpPath = extraFields.trainType == 'playbook' ? 'system.experience.value' : `system.attributes.${extraFields.trainType}.exp`;
    let newXPValue = Number(extraFields.trainType == 'playbook' ? extraFields.actor.system.experience.value : extraFields.actor.system.attributes[extraFields.trainType].exp) + xpGain;
    let maxXPValue = Number(extraFields.trainType == 'playbook' ? extraFields.actor.system.experience.max : extraFields.actor.system.attributes[extraFields.trainType].exp_max);
    let levelUp = newXPValue >= maxXPValue;
    newXPValue = newXPValue % maxXPValue;
    await BladesHelpers.tryUpdate(extraFields.actor, BladesHelpers.createUpdateObjectFromPath(newXPValue, xpPath));
    let trainTypeText = game.i18n.localize(`SFTD.Actions${BladesHelpers.capitalize(extraFields.trainType)}`);
    let trainTypeDescriptionKey = extraFields.trainType == 'playbook' ? 'SFTD.TrainTextGeneral' : 'SFTD.TrainTextStrider';
    let trainTypeDescription = game.i18n.format(trainTypeDescriptionKey, {trainType: trainTypeText});

    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/downtime/train-get.html', { train_type_desc: trainTypeDescription, train_type_text: trainTypeText, num: xpGain, level_up: levelUp, note: note, extraFields: extraFields });
  }
  // Check for Move Base
  else if (attributeOrRollName == 'SFTD.MoveCityRoll')
    result = await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/downtime/move-city-get.html', { note: note, extraFields: extraFields });

  let messageData = {
    speaker: speaker,
    content: result
  }
  ChatMessage.create(messageData);
}

export async function cancelRollResult(rollData, actorFull) {
  let crewFull = BladesHelpers.resolveActor(actorFull.system.crew);
  let crewUpdateObject = {};
  if (rollData.realShells)
    crewUpdateObject['system.shells.==value'] = Math.min(Math.max(Number(crewFull.system.shells.value) - rollData.realShells, 0), Number(crewFull.system.shells.max));
  if (rollData.realHarmony)
    crewUpdateObject['system.harmony.==value'] = Math.min(Math.max(Number(crewFull.system.harmony.value) - rollData.realHarmony, 0), Number(crewFull.system.harmony.max));
  if (Object.keys(crewUpdateObject).length > 0)
    await BladesHelpers.tryUpdate(crewFull, crewUpdateObject);

  for (let [stressChangeId, stressChange] of Object.entries(rollData.stressChanges)) {
    let stressActorFull = BladesHelpers.resolveActor(`Actor.${stressChangeId}`);
    await BladesHelpers.tryUpdate(stressActorFull, {'system.stress.==value': Math.min(Math.max(Number(stressActorFull.system.stress.value) - stressChange.realValue, 0), stressActorFull.system.stress.max)});
  }
  for (let [otherChangeId, otherChangeObj] of Object.entries(rollData.otherChanges)) {
    let otherActorFull = BladesHelpers.resolveActor(`Actor.${otherChangeId}`);
    if (otherActorFull) {
      let updateObject = {};
      for (let [otherPath, otherChange] of Object.entries(otherChangeObj.realValue)) {
        let otherValue = otherActorFull;
        for (let pathPart of otherPath.split('.')) {
          if (!otherValue)
            break;
          otherValue = otherValue[pathPart];
        }
        let resultOther = Math.max(Number(otherValue) - otherChange, 0);
        let updatePath = otherPath.split('.');
        updatePath[updatePath.length - 1] = '==' + updatePath[updatePath.length - 1];
        updatePath = updatePath.join('.');
        updateObject[updatePath] = resultOther;
      }
      await BladesHelpers.tryUpdate(otherActorFull, updateObject);
    }
  }

  let actorUpdateObject = {};
  if (rollData.downtime) {
    if (rollData.downtime.value != 0)
      actorUpdateObject['system.downtime_count.==value'] = actorFull.system.downtime_count.value - rollData.downtime.value;
    for (let activity of Object.keys(rollData.downtime.activities)) {
      if (activity != 'train_types')
        actorUpdateObject[`system.downtime_activities.==${activity}`] = false;
      for (let train_type of Object.keys(rollData.downtime.activities.train_types))
        actorUpdateObject[`system.downtime_activities.train_types.==${train_type}`] = false;
    }
  }
  if (rollData.melody)
    actorUpdateObject['system.==melody'] = true;
  if (Object.keys(actorUpdateObject).length > 0)
    await BladesHelpers.tryUpdate(actorFull, actorUpdateObject);

  for (let [connectionPair, connectionShift] of Object.entries(rollData.connections)) {
    let [ownerId, connectionId] = connectionPair.split('/');
    let ownerFull = BladesHelpers.resolveActor(`Actor.${ownerId}`);
    let connectionFull = BladesHelpers.resolveActor(`Actor.${connectionId}`);
    let connectionIndex = Object.entries(actorFull.system.connections).find(c => c[1].uuid == connectionFull.uuid)[0];
    let connection = actorFull.system.connections[connectionIndex];
    let connectionUpdateObject = {};
    connectionUpdateObject[`system.connections.${connectionIndex}.clock.==value`] = Math.min(Math.max(connection.clock.value - connectionShift, 0), 4);
    await BladesHelpers.tryUpdate(ownerFull, connectionUpdateObject);
  }

  for (let modifier of rollData.modifiers) {
    if (modifier.itemNeeded) {
      let exhaustableItems = actor.items.filter(i => i.system[modifier.itemNeeded] && Number(i.system.uses.value) < Number(i.system.uses.max));
      if (exhaustableItems.length > 0)
        await BladesHelpers.tryUpdate(exhaustableItems[exhaustableItems.length - 1], {'system.uses.==value': exhaustableItems[exhaustableItems.length - 1].system.uses.value + 1});
    }
    if (modifier.convictionCutLoose)
      await BladesHelpers.tryUpdate(actor, {'system.conviction_uses.==value': Math.max(Number(actor.system.conviction_uses.value) - 1, 0)});
    if (modifier.convictionExtra)
      await BladesHelpers.tryUpdate(actor, {'system.conviction_uses.==value': Math.min(Number(actor.system.conviction_uses.value) + 1, actor.system.conviction_uses.max)});
  }
}

const rollResultIndex = [ 'failure', 'partial-success', 'success', 'critical-success' ];
/**
 * Get status of the Roll.
 *  - failure
 *  - partial-success
 *  - success
 *  - critical-success
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollStatus(rolls, zeromode, modifiers) {
  // Sort roll values from lowest to highest.
  let sortedRolls = rolls.map(i => i.result).sort();

  let rollStatus, useDie, prevUseDie = false;

  if (zeromode)
    useDie = sortedRolls[0];
  else {
    useDie = sortedRolls[sortedRolls.length - 1];
    if (sortedRolls.length >= 2)
      prevUseDie = sortedRolls[sortedRolls.length - 2];
  }

  // 1,2,3 = failure
  if (useDie <= 3)
    rollStatus = 'failure';
  // if 6 - check the prev highest one.
  else if (useDie === 6) {
    // 6,6 - critical success (not for zeromode)
    if (!zeromode && prevUseDie == 6)
      rollStatus = 'critical-success';
    // 6 - success
    else
      rollStatus = 'success';
  }
  // else (4,5) = partial success
  else
    rollStatus = 'partial-success';

  // Add modifiers effect to the result
  let numberedRollStatus = rollResultIndex.indexOf(rollStatus);
  let extraResult = 0;
  for (let modifier of modifiers)
    if (modifier.result) {
      numberedRollStatus += modifier.result;
      extraResult += modifier.result;
    }
  rollStatus = rollResultIndex[Math.min(Math.max(numberedRollStatus, 0), 3)];

  return [rollStatus, useDie, extraResult];
}

/**
 * Get stress of the Roll.
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollResistanceStress(rolls, extraResult = 0, zeromode = false) {
  // Sort roll values from lowest to highest.
  let sortedRolls = rolls.map(i => i.result).sort();
  let result = Math.min(extraResult + sortedRolls[zeromode ? 0 : sortedRolls.length - 1], 6);
  if (!zeromode && sortedRolls.length >= 2 && sortedRolls[sortedRolls.length - 1] == 6 && sortedRolls[sortedRolls.length - 2] == 6)
    result += 1;
  let useDie = Math.max(Math.min(result, 7), 1);
  return 6 - useDie;
}

/**
 * Get Shells gained from a Collect Roll.
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollCollect(rolls, extraResult = 0, zeromode = false) {
  // Sort roll values from lowest to highest.
  let sortedRolls = rolls.map(i => i.result).sort();
  let result = extraResult + sortedRolls[zeromode ? 0 : sortedRolls.length - 1];
  if (!zeromode && sortedRolls.length >= 2 && sortedRolls[sortedRolls.length - 1] == 6 && sortedRolls[sortedRolls.length - 2] == 6)
    result += 1;
  result = Math.max(Math.min(result, 7), 1);
  return result == 7 ? 9 : result;
}

/**
 * Get stress cleared with a Cut Loose or Unwind Roll.
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollCutLooseUnwind(rolls, extraResult = 0, zeromode = false) {
  // Sort roll values from lowest to highest.
  let sortedRolls = rolls.map(i => i.result).sort();
  let result = extraResult + sortedRolls[zeromode ? 0 : sortedRolls.length - 1];
  result = Math.max(Math.min(result, 6), 1);
  return result;
}

/**
 * Get value used for various Downtime activity rolls.
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollDowntime(rolls, extraResult = 0, zeromode = false) {
  // Sort roll values from lowest to highest.
  let sortedRolls = rolls.map(i => i.result).sort();
  let useDie = sortedRolls[zeromode ? 0 : sortedRolls.length - 1];
  if (!zeromode && sortedRolls.length >= 2 && sortedRolls[sortedRolls.length - 1] == 6 && sortedRolls[sortedRolls.length - 2] == 6)
    useDie += 1;
  useDie = Math.max(Math.min(useDie, 7), 1);
  let result = extraResult + (useDie <= 3 ? 1 : useDie < 6 ? 2 : (useDie - 3));
  result = Math.max(Math.min(result, 4), 1);
  return result == 4 ? 5 : result;
}

export function getRollType(rollType, rollTypeLabel, first, single, strict, extraArg) {
  let dialogId = foundry.applications.api.ApplicationV2._appId + 1;
  return `
    <div class="radio-group">
      <label><input type="radio" id="${rollType}-${dialogId}" name="rollSelection"${first ? ' checked' : ''}> ${game.i18n.localize(rollTypeLabel)}</label>
      ${(!single && rollTypeArgs[rollType]) ? rollTypeArgs[rollType](strict, extraArg) : ''}
    </div>`
}

export const rollTypeLabels = {
  actionRoll: 'SFTD.ActionRoll',
  groupAction: 'SFTD.GroupActionRoll',
  resistance: 'SFTD.ResistanceRoll',

  aftermath: 'SFTD.AftermathRollFull',
  collectInfo: 'SFTD.CollectInformationRollFull',
  engagement: 'SFTD.EngagementRoll',
  fortune: 'SFTD.FortuneRoll',
  upkeep: 'SFTD.UpkeepRollFull',

  constructFoundation: 'SFTD.ConstructFoundationRoll',
  cutLooseBegin: 'SFTD.CutLooseBeginRoll',
  cutLoose: 'SFTD.CutLooseRoll',
  longTermProject: 'SFTD.LongTermProjectRoll',
  moveCity: 'SFTD.MoveCityRoll',
  recover: 'SFTD.RecoverRoll',
  reducePressure: 'SFTD.ReducePressureRoll',
  train: 'SFTD.TrainRoll',
  unwind: 'SFTD.UnwindRoll',

  manufacture: 'SFTD.ManufactureRoll',

  collectionAgency: 'SFTD.CollectionAgency',
  sideBusiness: 'SFTD.SideBusiness',

  specialist: 'SFTD.SpecialistRoll',
  groupSpecialist: 'SFTD.GroupSpecialistRoll'
}

const rollTypeArgs = {
  actionRoll: () => `
    <div>
      <span>
        <label>${game.i18n.localize('SFTD.Position')}:</label>
        <select id="pos" name="pos">
          <option value="controlled">${game.i18n.localize('SFTD.PositionControlled')}</option>
          <option value="risky" selected>${game.i18n.localize('SFTD.PositionRisky')}</option>
          <option value="desperate">${game.i18n.localize('SFTD.PositionDesperate')}</option>
        </select>
      </span>
      <span>
        <label>${game.i18n.localize('SFTD.ForcePosition')}:</label>
        <input type="checkbox" id="forcedPos" name="forcedPos">
      </span>
    </div>
    <div>
      <span>
        <label>${game.i18n.localize('SFTD.Impact')}:</label>
        <select id="impact" name="impact">
          <option value="weak">${game.i18n.localize('SFTD.ImpactWeak')}</option>
          <option value="normal" selected>${game.i18n.localize('SFTD.ImpactNormal')}</option>
          <option value="strong">${game.i18n.localize('SFTD.ImpactStrong')}</option>
        </select>
      </span>
      <span>
        <label>${game.i18n.localize('SFTD.ForceImpact')}:</label>
        <input type="checkbox" id="forcedImpact" name="forcedImpact">
      </span>
    </div>`,
  groupAction: (_, args) => `
    <span>
      <label>${game.i18n.localize('SFTD.Action')}:</label>
      <select id="groupActionAction" name="groupActionAction">${args.actions}</select>
    </span>`,
  aftermath: (_, args) => `
    <span>
      <label>${game.i18n.localize('SFTD.Hazard')}:</label>
      <select id="hazard" name="hazard">
        ${Array(4).fill().map((_, i) => `<option value="${i}"${args.hazard == i ? ' selected' : ''}>${i}</option>`).join('')}
      </select>
    </span>`,
  collectInfo: (_, args) => `
    ${args.actor?.type == 'strider' ? `<span>
      <label>${game.i18n.localize('SFTD.Action')}:</label>
      <select id="ciAction" name="ciAction">${args.actions}</select>
    </span>` : ''}
    <div>
      <span>
        <label>${game.i18n.localize('SFTD.Position')}:</label>
        <select id="pos" name="pos">
          <option value="controlled">${game.i18n.localize('SFTD.PositionControlled')}</option>
          <option value="risky" selected>${game.i18n.localize('SFTD.PositionRisky')}</option>
          <option value="desperate">${game.i18n.localize('SFTD.PositionDesperate')}</option>
        </select>
      </span>
      <span>
        <label>${game.i18n.localize('SFTD.ForcePosition')}:</label>
        <input type="checkbox" id="forcedPos" name="forcedPos">
      </span>
    </div>
    <div>
      <span>
        <label>${game.i18n.localize('SFTD.Impact')}:</label>
        <select id="impact" name="impact">
          <option value="weak">${game.i18n.localize('SFTD.ImpactWeak')}</option>
          <option value="normal" selected>${game.i18n.localize('SFTD.ImpactNormal')}</option>
          <option value="strong">${game.i18n.localize('SFTD.ImpactStrong')}</option>
        </select>
      </span>
      <span>
        <label>${game.i18n.localize('SFTD.ForceImpact')}:</label>
        <input type="checkbox" id="forcedImpact" name="forcedImpact">
      </span>
    </div>`,
  constructFoundation: (_, args) => `
    <span>
      <label>${game.i18n.localize('SFTD.Action')}:</label>
      <select id="cfAction" name="cfAction">${args.actions}</select>
    </span>
    <span>
      <label>${game.i18n.localize('SFTD.NewFoundation')} <a><i class="fas fa-question-circle" data-tooltip="${game.i18n.localize('SFTD.ConstructFoundationDragDropInfo')}"></i></a>:</label>
      <div id="cfNewFoundation">${game.i18n.localize('SFTD.None')}</div>
    </span>
    <span>
      <label>${game.i18n.localize('SFTD.Cost')}:</label>
      <select id="cfNewFoundationCost" name="cfNewFoundationCost"></select>
    </span>
    <span>
      <label>${game.i18n.localize('SFTD.Foundation')}:</label>
      <select id="cfFoundation" name="cfFoundation">${args.projects}</select>
    </span>`,
  longTermProject: (strict, args) => `
    ${args.actor?.type == 'strider' ? `<span>
      <label>${game.i18n.localize('SFTD.Action')}:</label>
      <select id="ltpAction" name="ltpAction">${args.actions}</select>
    </span>` : ''}
    <span>
      <label>${game.i18n.localize(`SFTD.Project${args.projects.includes('multiple>') ? 's' : ''}`)}:</label>
      <select id="ltpId" name="ltpId"${args.projects}</select>
    </span>`,
  manufacture: (_, args) => `
    <span>
      <label>${game.i18n.localize('SFTD.SuccessTier')}:</label>
      <input type="number" id="manufactureSuccessTier" name="manufactureSuccessTier" onkeypress="return BladesHelpers.isNumberKey(event)" value="0">
    </span>
    <span>
      <label>${game.i18n.localize('SFTD.Action')}:</label>
      <select id="manufactureAction" name="manufactureAction">
        <option value="engineer" selected>${game.i18n.localize('SFTD.ActionsEngineer')}</option>
        <option value="interface">${game.i18n.localize('SFTD.ActionsInterface')}</option>
      </select>
    </span>`,
  reducePressure: (_, args) => `
    ${args.actor?.type == 'strider' ? `<span>
      <label>${game.i18n.localize('SFTD.Action')}:</label>
      <select id="rpAction" name="rpAction">${args.actions}</select>
    </span>` : ''}
    ${args.needsHazardReduction ? `<span>
      <label>${game.i18n.localize('SFTD.ReduceHazard')}:</label>
      <input type="checkbox" id="rpHazard" name="rpHazard" checked>
    </span>` : ''}`,
  upkeep: (strict, args) => `
    <span>
      <label>${game.i18n.localize('TYPES.Actor.faction')} <a><i class="fas fa-question-circle" data-tooltip="${game.i18n.localize('SFTD.UpkeepDragDropInfo')}"></i></a>:</label>
      <div id="upkeepFaction">${game.i18n.localize('SFTD.None')}</div>
    </span>
    <span>
      <label>${game.i18n.localize('SFTD.RegionProsperity')}:</label>
      <select id="upkeepRegionProsperity" name="upkeepRegionProsperity">
        <option value="None" selected>${game.i18n.localize('SFTD.None')}</option>
        ${Array(6).fill().map((_, i) => `<option value="${i}">${i}</option>`).join('')}
      </select>
    </span>`,
  train: (strict, args) => `
    <span>
      <label>${game.i18n.localize('SFTD.Type')}:</label>
      <select id="trainType" name="trainType">${args.trainTypes}</select>
    </span>`,
  unwind: (strict, args) => `
    <span>
      <label>${game.i18n.localize('TYPES.Actor.npc')}:</label>
      <select id="unwindNpc" name="unwindNpc">${args.npcs}</select>
    </span>`,
  specialist: (_) => `
    <span>
      <label>${game.i18n.localize('SFTD.WithinExpertise')}:</label>
      <input type="checkbox" id="expertise" name="expertise" checked>
    </span>`,
  groupSpecialist: (_) => `
    <span>
      <label>${game.i18n.localize('SFTD.WithinExpertise')}:</label>
      <input type="checkbox" id="expertise" name="expertise" checked>
    </span>`
}

export function buildRollPopup(popupTitle, actor, rollTypes, missingRollTypes = {}, strict = true, forcedFields = {}, extraData = {}) {
  let currentStress = 0;
  let currentTier = 0;
  let shells = 0;
  let hazard = 0;
  if (actor) {
    let crewFull = actor.type == 'crew' ? actor : actor.type == 'strider' ? BladesHelpers.resolveActor(actor.system.crew) : null;
    if (actor.type == 'strider')
      currentStress = Number(actor.system.stress.value);
    if (crewFull) {
      currentTier = crewFull.getTier();
      shells = crewFull.system.shells.value;
      hazard = crewFull.system.hazard.value;
    }
  }
  let thirdArg = {actor: actor, forcedFields: forcedFields, currentTier: currentTier, shells: shells, hazard: hazard};

  let missingRollTypesPopup = Object.entries(missingRollTypes).map((v, i) => `<br/>${v[0]}: ${v[1]}`).join('');
  if (missingRollTypesPopup)
    missingRollTypesPopup = game.i18n.localize('SFTD.BadRollPopup') + missingRollTypesPopup;

  let rollTypesHTML = '', rollTypesArgs = '';
  for (let rollType of rollTypes) {
    if (rollType == 'groupAction') {
      let actionsText = `<option value="${extraData.action}">${game.i18n.localize(BladesHelpers.getAttributeLabel(extraData.action))}</option>`;
      if (extraData.action != 'command')
        actionsText += `<option value="command">${game.i18n.localize(BladesHelpers.getAttributeLabel('command'))}</option>`;

      thirdArg = {...thirdArg, actions: actionsText};
    } else if (rollType == 'cutLoose') {
      let connectionsText = '';
      let crewFull = BladesHelpers.resolveActor(actor.system.crew);
      if (crewFull) {
        for (let member of Object.values(crewFull.system.members)) {
          if (member.uuid == actor.uuid) continue;
          let memberFull = BladesHelpers.resolveActor(member.uuid);
          if (memberFull?.type == 'strider')
            connectionsText += `<option value="${memberFull.uuid}">${memberFull.name}</option>`;
        }
      }

      thirdArg = {...thirdArg, currentStress: currentStress, connectionsText: connectionsText};
    } else if (['fix', 'recover'].includes(rollType)) {
      let healActors = `<option value="${actor.uuid}" selected>${actor.name}${(rollType == 'recover' && !actor.system.doctor) ? ` (${game.i18n.localize('SFTD.NoDoctor')})` : ''}</option>`;
      let crewFull = BladesHelpers.resolveActor(actor.system.crew);
      if (crewFull) {
        for (let member of Object.values(crewFull.system.members)) {
          if (member.uuid == actor.uuid) continue;
          let memberFull = BladesHelpers.resolveActor(member.uuid);
          if (memberFull?.type == 'strider' && (rollType == 'fix' || (rollType == 'recover' && memberFull.system.doctor)))
            healActors += `<option value="${memberFull.uuid}">${memberFull.name}</option>`;
        }
        for (let specialistFull of crewFull.items.contents.filter(i => i.type == 'specialist'))
          if (rollType == 'fix' || (rollType == 'recover' && specialistFull.system.type == 'Expert' && specialistFull.system.doctor))
            healActors += `<option value="${specialistFull.uuid}">${specialistFull.name}</option>`;
      }

      thirdArg = {...thirdArg, healActors: healActors};
    } else if (['collectInfo', 'constructFoundation', 'longTermProject','reducePressure'].includes(rollType) && actor?.type == 'strider') {
      let actionList = Object.keys(actor.getRollData().diceAmount).filter(a => BladesHelpers.isAttributeAction(a));
      let actions = actionList.map((value, index) => `<option value="${value}"${((rollType != 'constructFoundation' && index == 0) || (rollType == 'constructFoundation' && value == 'shape')) ? ' selected' : ''}>${game.i18n.localize(BladesHelpers.getAttributeLabel(value))}</option>`).join('');

      thirdArg = {...thirdArg, actions: actions};
    } else if (rollType == 'train') {
      let trainTypes = ['playbook'];
      let trainTypesText = '';
      for (let [trainTypeName, trainType] of Object.entries(actor.system.attributes))
        trainTypes.push(trainTypeName);
      for (let usedTrainType of Object.keys(actor.system.downtime_activities.train_types))
        trainTypes.splice(trainTypes.indexOf(usedTrainType), 1);
      trainTypesText = trainTypes.map((t, i) => `<option value="${t}"${i == 0 ? ' selected' : ''}>${game.i18n.localize(`SFTD.Actions${BladesHelpers.capitalize(t)}`)}</option>`).join('');

      thirdArg = {...thirdArg, trainTypes: trainTypesText};
    } else if (rollType == 'unwind') {
      const crewFull = BladesHelpers.resolveActor(actor.system.crew);
      let npcsText = Object.values(crewFull.system.members)
        .map(m => BladesHelpers.resolveActor(m)).filter(m => m && m.type == 'npc')
        .map((m, i) => `<option value="${m.uuid}"${i == 0 ? ' selected' : ''}>${m.name}`).join('');
      npcsText += `<option value="other">${game.i18n.localize('SFTD.Other')}</option>`;
      npcsText += `<option value="group">${game.i18n.localize('SFTD.Group')}</option>`;

      thirdArg = {...thirdArg, npcs: npcsText};
    }
    if (rollType == 'constructFoundation') {
      let crewFull = BladesHelpers.resolveActor(actor.system.crew);
      let projectList = Object.entries(crewFull.system.projects).filter(p => Number(p[1].clock.value) < Number(p[1].clock.max) && p[1].foundation);
      let projectsString = `<option value="None" selected>${game.i18n.localize('SFTD.None')}</option>` + projectList.map(p => `<option value="${p[0]}">${p[1].title}</option>`).join('');

      thirdArg = {...thirdArg, projects: projectsString};
    } else if (rollType == 'longTermProject') {
      let crewFull = BladesHelpers.resolveActor(actor.system.crew);
      let projectList = Object.entries(crewFull.system.projects).filter(p => Number(p[1].clock.value) < Number(p[1].clock.max) && !p[1].foundation);
      let projectsString = projectList.map(p => `<option value="${p[0]}"${p[0] == 0 ? ' selected' : ''}>${p[1].title}</option>`).join('');
      projectsString = `${(rollType == 'longTermProject' && crewFull.system.irons_in_the_fire) ? ` data-tooltip="SFTD.MultipleSelectUsage" size="${Math.min(projectList.length, 4)}" multiple` : ''}>${projectsString}`;

      thirdArg = {...thirdArg, projects: projectsString};
    } else if (rollType == 'reducePressure') {
      let crewFull = BladesHelpers.resolveActor(actor.system.crew);
      thirdArg = {...thirdArg, needsHazardReduction: crewFull.system.hazard.value > 0};
    }
    rollTypesHTML += getRollType(rollType, rollTypeLabels[rollType], rollTypesHTML.length == 0, rollTypes.length == 1, strict, thirdArg);
    rollTypesArgs += rollTypeArgs[rollType] ? rollTypeArgs[rollType](strict, thirdArg) : '';
  }

  return `
    <h2>${popupTitle}</h2>
    ${!actor ? `<p>${game.i18n.localize('SFTD.RollTokenDescription')}</p>` : ''}
    <form>
      <div class="form-group">
        ${!strict ? `<label>${game.i18n.localize('SFTD.RollNumberOfDice')}:</label>
        <select id="qty" name="qty">
          <option value="0" selected disabled hidden>0d</option>
          ${Array(14).fill().map((_, i) => `<option value="${i-3}">${i-3}d</option>`).join('')}
        </select>`
        : `<label>${game.i18n.localize('SFTD.Modifier')}:</label>
        <select id="mod" name="mod">
          ${createListOfDiceMods(-3, +3, 0)}
        </select>`}
      </div>
      <fieldset class="form-group"${rollTypes.length == 1 ? ' hidden' : ''}>
        <legend>${game.i18n.localize('SFTD.RollTypes')}${missingRollTypesPopup ? ` <i class="fas fa-question-circle" data-tooltip="${missingRollTypesPopup}"></i>` : ''}</legend>
        ${rollTypesHTML}
      </fieldset>
      ${(rollTypesArgs != '' && rollTypes.length == 1) ? `
      <fieldset class="form-group">
        <legend>${game.i18n.localize('SFTD.Arguments')}</legend>
        ${rollTypesArgs}
      </fieldset>` : ''}
      <fieldset class="form-group toggleable-modifiers">
        <legend>${game.i18n.localize('SFTD.ToggleableModifiers')}</legend>
      </fieldset>
      <div class="form-group">
        <label>${game.i18n.localize('SFTD.Notes')}:</label>
        <input id="note" name="note" type="text" value="">
      </div>
    </form>`;
}

export function getMiscRollTypesToRemove(actorFull) {
  let rollTypes = ['aftermath', 'collectInfo', 'engagement', 'fortune', 'upkeep'];
  let missingRollTypes = {};

  if (!actorFull) {
    BladesHelpers.addToRollTypeError(missingRollTypes, 'aftermath', 'SFTD.BadRoll.NoActor');
  } else {
    let crewFull = BladesHelpers.resolveActor(actorFull.system.crew);
    if (!crewFull)
      BladesHelpers.addToRollTypeError(missingRollTypes, 'aftermath', 'SFTD.BadRoll.NoCrew');
  }

  return [
    rollTypes.filter(r => !Object.keys(missingRollTypes).includes(r)),
    Object.fromEntries(Object.entries(missingRollTypes).map((v, i) => [game.i18n.localize(`SFTD.${v[0][0].toUpperCase() + v[0].slice(1)}Roll`), v[1]]))
  ];
}

/**
 * Call a Roll popup.
 */
export async function simpleRollPopup(title1 = 'SFTD.SimpleRoll', title2 = 'SFTD.RollSomeDice', forcedActor = null, strict = false) {
  let selectedTokens = canvas.tokens.controlled;
  let targetActor = forcedActor;
  if (!targetActor && selectedTokens.length > 0)
    targetActor = game.actors.get(selectedTokens[0].document.actorId);

  // Fetch roll modifiers (if an Actor was selected)
  let allPermanentModifiers = [];
  let allConditionalModifiers = [];
  let _;
  if (targetActor) {
    [_, allPermanentModifiers, allConditionalModifiers] = targetActor.getModifiers();
    allPermanentModifiers = await resolveRollModifierArray(allPermanentModifiers, targetActor);
    allConditionalModifiers = await resolveRollModifierArray(allConditionalModifiers, targetActor, true);
    allConditionalModifiers = pruneInvalidConditionalRollModifiers(targetActor, allConditionalModifiers);
  }

  let [rollTypes, missingRollTypes] = getMiscRollTypesToRemove(targetActor);
  let dialog = new foundry.applications.api.DialogV2({
    window: { title: `${game.i18n.localize(title1)}` },
    content: buildRollPopup(game.i18n.localize(title2), targetActor, rollTypes, missingRollTypes, strict),
    buttons: [
      {
        icon: 'fas fa-check',
        label: game.i18n.localize('SFTD.Roll'),
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

      let diceQty = Number(dialog.element.querySelector('[name="qty"]').value);
      let note = dialog.element.querySelector('[name="note"]').value;

      // Fetch actor roll modifiers & enabled conditional roll modifiers
      let enabledConditionalModifiers = resolveConditionalModifiers(dialog, targetActor);
      enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);

      let input = dialog.element.querySelector('input[type=radio]:checked');
      if (input) {
        let rollType = input.id.split('-')[0];
        let extraFields = { roll_type: rollType, modifiers: [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ], actor: targetActor };
        let crewFull = BladesHelpers.resolveActor(targetActor?.system.crew);
        switch (rollType) {
          case 'aftermath':
            extraFields.hazard = Number(dialog.element.querySelector('[name="hazard"]').value);
            extraFields.pressure = crewFull.system.pressure.value;
            let aftermathDice = Math.min(Math.ceil(extraFields.pressure / 3), 3);
            await bladesRoll(aftermathDice + diceQty, 'SFTD.AftermathRoll', note, extraFields);
            break;
          case 'collectInfo':
            let attributeName = dialog.element.querySelector('[name="ciAction"]').value;
            let collectInfoDiceAmount = targetActor?.getRollData().diceAmount[attributeName] ?? 0;
            let position = dialog.element.querySelector('[name="pos"]').value;
            let forcedPosition = dialog.element.querySelector('[name="forcedPos"]').checked;
            let impact = dialog.element.querySelector('[name="impact"]').value;
            let forcedImpact = dialog.element.querySelector('[name="forcedImpact"]').checked;
            extraFields = { attributeName: BladesHelpers.getAttributeLabel(attributeName), position: position, forcedPosition: forcedPosition, impact: impact, forcedImpact: forcedImpact, ...extraFields };
            await bladesRoll(collectInfoDiceAmount + diceQty, 'SFTD.CollectInformationRoll', note, extraFields);
            break;
          case 'engagement':
            await bladesRoll(diceQty, 'SFTD.EngagementRoll', note, extraFields);
            break;
          case 'fortune':
            await bladesRoll(diceQty, 'SFTD.FortuneRoll', note, extraFields);
            break;
          case 'upkeep':
            let upkeepFactionUuid = dialog.element.querySelector('#upkeepFaction > .actor-contents')?.dataset.actorId;
            let upkeepFactionFull = BladesHelpers.resolveActor(upkeepFactionUuid);
            extraFields.upkeepFaction = upkeepFactionFull;
            let upkeepRegionProsperity = Number(dialog.element.querySelector('[name="upkeepRegionProsperity"]').value);
            let upkeepDice = upkeepFactionFull?.system.tier.value ?? upkeepRegionProsperity;
            await bladesRoll(upkeepDice + diceQty, 'SFTD.UpkeepRoll', note, extraFields);
            break;
        }
        if (targetActor)
          await postRollProcessing(targetActor, extraFields);
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
  dialog.actor = targetActor;
  await dialog.render(true);

  dialog.element.addEventListener('drop', async (ev) => {
    ev.preventDefault();
    let element = ev.currentTarget;
    const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
    if (dropData.uuid) {
      let dropFull = BladesHelpers.resolveActor(dropData.uuid);
      if (dropFull.type == 'faction') {
        // Drop a Faction for the Upkeep roll
        element.querySelector('#upkeepFaction').innerHTML = `
          <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
            <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
            <a class="item-name">${dropFull.name}</a>
            <a class="delete-actor"><i class="fas fa-times"></i></a>
          </div>`;
        element.querySelector('#upkeepFaction .delete-actor').addEventListener('click', (ev) => {
          let element = ev.currentTarget;
          let windowElement = element.closest('.application.dialog');
          element.closest('#upkeepFaction').innerHTML = game.i18n.localize('SFTD.None');
          checkMiscRollCanRoll({currentTarget: windowElement});
        });
        checkMiscRollCanRoll(ev);
      }
    }
  });

  let htmlElement = dialog.element;
  let checkMiscRollCanRoll = function(ev) {
    let element = ev.currentTarget;
    let windowElement = element.matches('.application.dialog') ? element : element.closest('.application.dialog');
    let currentRadio = windowElement.querySelector('.radio-group:has(> label > input[type=radio]:checked) > label > input[type=radio]');
    let rollType = currentRadio.id.split('-')[0];
    let rollButton = windowElement.querySelector('button[data-action="roll"]');
    let allowedToRoll = true;
    if (rollType == 'upkeep')
      allowedToRoll = windowElement.querySelector('#upkeepFaction > .actor-contents') != null || windowElement.querySelector('#upkeepRegionProsperity').value != 'None';
    rollButton.disabled = !allowedToRoll;
  }

  for (let element of htmlElement.querySelectorAll('input[type=radio]')) {
    element.addEventListener('click', async (ev) => {
      // Connection update & Trigger it
      let crewmateSelector = ev.currentTarget.closest('.window-content').querySelector('.modifier[data-modifier="assist"] select[field="SFTD.Crewmate"]');
      if (crewmateSelector) {
        crewmateSelector.addEventListener('change', (event) => {
          let modifierElement = $(crewmateSelector).closest(".modifier");
          let crewmateSelectElementVal = $(modifierElement).find('span:first-of-type select').val();
          if (!crewmateSelectElementVal)
            return;

          let crewmateFull = BladesHelpers.resolveActor(crewmateSelectElementVal);
          let notAProblemElement = crewmateSelector.closest('.modifier[data-modifier="assist"]').querySelector('input[name="SFTD.NotAProblem"]');
          let notAProblemFieldGroup = notAProblemElement.parentElement;
          let activeNotAProblem = crewmateFull.system.not_a_problem && crewmateFull.system.not_a_problem_uses.value > 0;
          if (!activeNotAProblem)
            notAProblemElement.checked = false;
          notAProblemFieldGroup.style.display = activeNotAProblem ? null : 'none';
        });

        var event = new Event('change');
        crewmateSelector.dispatchEvent(event);
      }

      await checkMiscRollCanRoll(ev);
    });
  }

  var event = new Event('click');
  dialog.element.querySelectorAll('input[type=radio]')[0].dispatchEvent(event);

  for (let element of htmlElement.querySelectorAll('#upkeepRegionProsperity'))
    element.addEventListener('change', checkMiscRollCanRoll);
}

export function dialogOnFirstRender(context, options, thisPass) {
  let dialog = this ?? thisPass;
  let query = dialog.element.querySelectorAll('.radio-group input[type=radio]');
  let position = dialog.element.querySelector('[name="impact"]');
  for (let el of query) {
    el.addEventListener('click', (event) => {
      dialog.refreshModifiers(dialog, event.target.id.split('-')[0], position?.value, dialog.attributeName);

      let rollButton = dialog.element.querySelectorAll('button[data-action=roll]')[0];
      let rollType = el.id.split('-')[0];
      let buttonAvailable = true;
      if (rollType == 'cutLoose') {
        let connections = dialog.element.querySelector('select[name=connection]');
        buttonAvailable = connections.innerHTML.length != 0;
      }
      rollButton.disabled = !buttonAvailable;
    });
  }
  dialog.refreshModifiers(dialog, dialog.rollTypes[0], position?.value, dialog.attributeName);
}

export function dialogOnRender(context, options, thisPass) {
  let dialog = this ?? thisPass;
  let position = dialog.element.querySelector('[name="impact"]');
  dialog.refreshModifiers(dialog, dialog.rollTypes[0], position?.value, dialog.attributeName);
}

export function refreshModifiers(dialog, rollType, rollPosition, attributeName) {
  dialog.permanentModifiers = keepValidModifiersFromRollType(dialog.allPermanentModifiers, rollType, rollPosition, attributeName);
  dialog.conditionalModifiers = keepValidModifiersFromRollType(dialog.allConditionalModifiers, rollType, rollPosition, attributeName);
  let newConditionalModifiersHTML = buildConditionalModifiersHTML(dialog.conditionalModifiers, dialog.actor);
  dialog.element.querySelector('.toggleable-modifiers').innerHTML = newConditionalModifiersHTML;
  dialog.element.querySelector('.toggleable-modifiers').style.display = Object.entries(dialog.conditionalModifiers.filter(m => !m.hidden)).length == 0 ? 'none' : '';
}

export function getRollModifiers(actor) {
  let modifiers = actor.system.roll_modifiers;
  if (actor.system.crew) {
    let crewFull = BladesHelpers.resolveActor(actor.system.crew);
    // Fetch crew-level modifiers applying to the strider
    if (crewFull?.system.roll_modifiers.strider !== undefined)
      modifiers = {...modifiers, ...crewFull.system.roll_modifiers.strider};
  }

  let output = [];
  if (modifiers)
    for (let [key, value] of Object.entries(modifiers))
      if (value === true)
        output.push(bladesRollModifierList[key]);
  return output;
}

/**
 * Creates <options> modifiers for dice roll.
 *
 * @param {int} rs Min die modifier
 * @param {int} re Max die modifier
 * @param {int} s Selected die
 */
function createListOfDiceMods(rs, re, s) {
  var text = ``;
  var i = 0;

  if (s == '')
    s = 0;

  for (i = rs; i <= re; i++)
    text += `<option value="${i}"${i == s ? ' selected' : ''}>${i >= 0 ? '+' : ''}${i}d</option>`;

  return text;
}

export function keepValidModifiersFromRollType(modifiers, rollType, rollPosition, attributeName) {
  let output = [];
  for (let modifier of modifiers) {
    if (modifier.rollType && modifier.rollType != rollType) continue;
    if (modifier.rollTypes && !modifier.rollTypes.includes(rollType)) continue;
    if (modifier.notRollTypes && modifier.notRollTypes.includes(rollType)) continue;
    if (modifier.rollPosition && modifier.rollPosition != rollPosition) continue;
    if (modifier.attributeName && modifier.attributeName != attributeName) continue;
    if (modifier.attributesName && !modifier.attributesName.includes(attributeName)) continue;
    output.push(modifier);
  }
  return output;
}

export function keepValidModifiersFromStatus(modifiers, rollStatus) {
  let output = [];
  for (let modifier of modifiers) {
    if (modifier.rollStatus && !modifier.rollStatus.includes(rollStatus))continue;
    output.push(modifier);
  }
  return output;
}

export function keepValidModifiersFromOther(modifiers) {
  let output = [];
  let pushingYourself = false;
  let protecting = false;
  let usingHarmony = false;
  for (let modifier of modifiers) {
    if (modifier.pushYourself) pushingYourself = true;
    if (modifier.needPushYourself && !pushingYourself) continue;
    if (modifier.protect) protecting = true;
    if (modifier.needProtect && !protecting) continue;
    if (modifier.isHarmony) usingHarmony = true;
    if (modifier.needHarmony && !usingHarmony) continue;
    output.push(modifier);
  }
  return output;
}

function computeModifierMessages(modifiers) {
  let output = '';
  for (let modifier of modifiers)
    if (modifier.rollText)
      output += `<p>${game.i18n.format(modifier.rollText, modifier.rollTextArgs ?? {})}</p>`;
  return output;
}

export async function resolveRollModifierArray(modifiers, actorFull, conditional = false, attributeName = null) {
  let output = [];

  if (conditional) {
    let harmContainer = actorFull?.system.harm;
    if (harmContainer && BladesHelpers.isAttributeAction(attributeName)) {
      let relentless = actorFull?.system.relentless;
      let levelOneHarms = Object.values(relentless ? harmContainer.medium : harmContainer.light).filter(h => h != '');
      let levelTwoHarms = Object.values(relentless ? harmContainer.heavy : harmContainer.medium).filter(h => h != '');
      let harms = [ ...levelOneHarms.map(h => [1, h]),  ...levelTwoHarms.map(h => [2, h]) ];
      let idToNumber = {
        1: 'one',
        2: 'two',
        3: 'three'
      }
      for (let harm of harms) {
        let key = relentless ? `level_${idToNumber[harm[0] + 1]}_harm_relentless` : `level_${idToNumber[harm[0]]}_harm`;
        let result = foundry.utils.deepClone(bladesRollModifierList[key]);
        result.key = key;
        result.nameArgs.harm = harm[1];
        output.push(result);
      }
    }
  }

  if (modifiers)
    for (let [key, value] of Object.entries(modifiers)) {
      if (value === true)
        if (Object.keys(bladesRollModifierList).includes(key)) {
          let result = foundry.utils.deepClone(bladesRollModifierList[key]);
          if (result.exclude)
            continue;
          result.key = key;
          if (result.push_yourself) {
            // Push Yourself: Choose the right cost
            if (actorFull.type != 'strider') continue;
            if (actorFull.system.melody_push_yourself_options.length && actorFull.system.melody) {
              result.fields['SFTD.Cost'] = ['SFTD.Stress', 'SFTD.Melody'];
              result.fields['SFTD.Usage'] = ['SFTD.None'].concat(actorFull.system.melody_push_yourself_options.map(o => `SFTD.MelodyPushOptions.${o}.Key`));
            } else {
              result.fields['SFTD.Cost'] = undefined;
              result.fields['SFTD.Usage'] = undefined;
            }
          } else if (result.assist || result.setup || result.protect) {
            // Assist & Co.: List all other Striders in the Crew
            if (actorFull.type != 'strider') continue;
            let crewFull = BladesHelpers.resolveActor(actorFull.system.crew);
            if (!crewFull) continue;
            if (Object.values(crewFull.system.members).length == 1) continue;
            result.fields['SFTD.Crewmate'] = {};
            for (let strider of Object.values(crewFull.system.members)) {
              if (strider.uuid == actorFull.uuid) continue;
              let striderFull = BladesHelpers.resolveActor(strider.uuid);
              if (striderFull.type != 'strider') continue;
              result.fields['SFTD.Crewmate'][strider.uuid] = striderFull.name;
            }
            if (result.protect)
              result.fields['SFTD.Crewmate'][''] = 'SFTD.Other';
            if (!Object.values(result.fields['SFTD.Crewmate']).length) continue;
            if (result.setup && crewFull.system.charmsync_push_yourself_owners?.length)
              result.fields['SFTD.Effect'].push('SFTD.BothCharmsync');
          } else if (result.downtime_assist) {
            // Downtime Assist: List all Strider Crew Members, Strider Connections and Specialists
            if (actorFull.type != 'strider') continue;
            result.fields['SFTD.Helper'] = {};
            let crewFull = BladesHelpers.resolveActor(actorFull.system.crew);
            if (crewFull) {
              for (let member of Object.values(crewFull.system.members)) {
                if (member.uuid == actorFull.uuid) continue;
                let striderFull = BladesHelpers.resolveActor(member.uuid);
                if (striderFull.type != 'strider') continue;
                result.fields['SFTD.Helper'][striderFull.uuid] = striderll.name;
              }
            }
            if (crewFull)
              for (let specialist of crewFull.items.filter(i => i.type == 'specialist'))
                result.fields['SFTD.Helper'][specialist.uuid] = specialist.name;
            result.fields['SFTD.Helper'][''] = 'SFTD.Other';
          }
          output.push(result);
        } else
          console.error(`Unknown modifier '${key}'`);
    }

  // Crew-wide modifiers
  let crewFull = BladesHelpers.resolveActor(actorFull.system.crew);
  if (crewFull) {
    for (let [modifierId, modifierData] of Object.entries(BladesHelpers.crewWideModifiers).filter(m => m[1].conditional == conditional)) {
      let modifierOwners = foundry.utils.deepClone(crewFull.system[`${modifierId}_owners`]);
      if (!modifierData.includeOwner) {
        let ownerId = modifierOwners.indexOf(actorFull.uuid);
        if (ownerId >= 0)
          modifierOwners.splice(ownerId, 1);
      }

      let result = foundry.utils.deepClone(bladesRollModifierList[modifierId]);
      if (!result)
        continue;
      result.key = modifierId;
      output.push(result);
    }
  }
  return output;
}

export function pruneInvalidConditionalRollModifiers(actorFull, modifiers) {
  let output = [];
  for (let modifier of modifiers) {
    if (modifier.invalid) continue;
    if (modifier.itemNeeded && actorFull.items)
      if (actorFull.items.filter(i => i.system[modifier.itemNeeded] && (i.system.uses.max == i.system.uses.value || i.system.uses.value > 0)).length == 0) continue;
    if (modifier.conviction && (!actorFull || actorFull.system.conviction_uses?.value == 0)) continue;
    if (modifier.terminator) {
      let ownerFull = BladesHelpers.resolveActor(actorFull.system.owner);
      if (!ownerFull) continue;
      if (!ownerFull.items.find(i => i.system.terminator)) continue;
    }
    if (modifier.factionTrust) {
      let crewFull = BladesHelpers.resolveActor(actorFull.system.crew);
      if (!crewFull?.system.faction) continue;
      let factionFull = BladesHelpers.resolveActor(crewFull.system.faction);
      if (!factionFull) continue;
    }
    if (modifier.shells) {
      let crewFull = BladesHelpers.resolveActor(actorFull.system.crew);
      if (!crewFull) continue;
    }
    if (modifier.needsRegion) {
      let regionFull = BladesHelpers.resolveActor(actorFull.system.region);
      if (!regionFull) continue;
    }
    if (modifier.checkFunc) {
      let extraData = {actorFull: actorFull};
      if (!modifier.checkFunc(extraData))
        continue;
    }
    output.push(modifier);
  }
  return output;
}

export function buildConditionalModifiersHTML(modifiers, actorFull) {
  let output = `<legend>${game.i18n.localize('SFTD.ToggleableModifiers')}</legend>`;
  for (let [id, modifier] of Object.entries(modifiers)) {
    if (modifier.hidden) continue;
    if (modifier.nameArgs)
      modifier.nameArgs = parseNameArgs(modifier.nameArgs, actorFull);
    let title = modifier.nameArgs ? game.i18n.format(modifier.name, modifier.nameArgs) : game.i18n.localize(modifier.name);
    output += `<div class="modifier" data-modifier="${modifier.key}" data-modifier-id=${id}><label><input type="checkbox"> ${title}</label>`;
    if (modifier.fields) {
      for (let [fieldName, fieldDataArray] of Object.entries(modifier.fields)) {
        if (fieldDataArray == undefined)
          continue;
        output += `<span><label>${game.i18n.localize(fieldName)}</label>`
        if (fieldDataArray == true || fieldDataArray == false)
          output += `<input type="checkbox" name="${fieldName}" ${fieldDataArray ? ' checked' : ''}>`;
        else if (fieldDataArray instanceof Array) {
          let first = true;
          let multiple = fieldName == 'SFTD.Effects';
          output += `<select field="${fieldName}"${multiple ? ' data-tooltip="SFTD.MultipleSelectUsage" multiple': ''}>`
          for (let fieldData of fieldDataArray) {
            output += `<option value="${fieldData}" ${first ? 'selected' : ''}>${game.i18n.localize(fieldData)}</option>`;
            first = false;
          }
          output += '</select>';
        } else {
          let first = true;
          let multiple = fieldName == 'SFTD.Effects';
          output += `<select field="${fieldName}"${multiple ? ' data-tooltip="SFTD.MultipleSelectUsage" multiple': ''}>`
          for (let [fieldDataInternal, fieldData] of Object.entries(fieldDataArray)) {
            output += `<option value="${fieldDataInternal}" ${first ? 'selected' : ''}>${game.i18n.localize(fieldData)}</option>`;
            first = false;
          }
          output += '</select>';
        }
        output += '</span>';
      }
    }
    output += '</div>';
  }
  return output;
}

function parseNameArgs(nameArgs, actorFull) {
  if (!actorFull) return nameArgs;

  let output = {};
  for (let [argName, argValue] of Object.entries(nameArgs)) {
    let processedArg = '';
    for (let [id, val] of Object.entries(argValue.split('{'))) {
      if (id == 0) {
        processedArg = val;
        continue;
      }
      let [key, rest] = val.split('}', 1);
      let keyData = actorFull;
      for (let pathPart of key.split('.')) {
        keyData = keyData[pathPart];
        if (Array.isArray(keyData) || keyData == null) {
          keyData == 'undefined';
          break;
        } else if (typeof keyData == 'string' && keyData.startsWith('Actor')) {
          keyData = BladesHelpers.resolveActor(keyData);
          if (!keyData) {
            keyData = 'undefined';
            break;
          }
        }
      }
      processedArg += String(keyData) + (rest ?? '');
    }
    output[argName] = processedArg;
  }
  return output;
}

export function resolveConditionalModifiers(dialog, actorFull, attributeName) {
  let checkedModifiers = dialog.element.querySelectorAll('.modifier:has(label > input[type=checkbox]:checked)')
  let output = [];
  for (let checkedModifier of checkedModifiers) {
    let conditionalModifier = foundry.utils.deepClone(dialog.conditionalModifiers[parseInt(checkedModifier.dataset.modifierId)]);

    if (conditionalModifier.resolveFunc !== undefined) {
      let selectElements = checkedModifier.querySelectorAll('span > select');
      let fields = {};
      for (let field of selectElements)
        fields[field.attributes.field.value] = $(field).val();
      let checkboxElements = checkedModifier.querySelectorAll('span > input[type=checkbox]');
      for (let checkbox of checkboxElements)
        fields[checkbox.attributes.name.value] = checkbox.checked;
      let divElements = checkedModifier.querySelectorAll('& > div');
      for (let div of divElements)
        fields[div.dataset.field] = Array.from(div.querySelectorAll('div')).map(d => d.dataset.value);

      let extraData = {actorFull: actorFull};
      if (actorFull.system.crew) {
        let crewFull = BladesHelpers.resolveActor(actorFull.system.crew);
        let groupAction = crewFull?.system.group_action;
        if (groupAction) {
          let leaderFull = BladesHelpers.resolveActor(groupAction.leader);
          extraData.leader = leaderFull.name;
        }
      }
      extraData.modifiers = dialog.permanentModifiers.concat(Array.from(checkedModifiers).map(m => dialog.conditionalModifiers[parseInt(m.dataset.modifierId)]));
      conditionalModifier = conditionalModifier.resolveFunc(fields, extraData);
      if (!conditionalModifier)
        continue;
    }

    // Telepathy: Use the leader's action rating instead of the current player's
    if (conditionalModifier.telepathy && actorFull.system.crew) {
      let crewFull = BladesHelpers.resolveActor(actorFull.system.crew);
      let groupAction = crewFull?.system.group_action;
      if (groupAction) {
        // Don't let the leader use the ability
        if (groupAction.leader == actorFull.uuid) continue;
        let actorActionRating = actorFull.getRollData().diceAmount[groupAction.action];
        conditionalModifier.dice = groupAction.leader_action - actorActionRating;
      }
    }

    // Crowdsource: Use the selected crewmate's action rating instead of the current player's
    if (conditionalModifier.crowdsource) {
      let targetFull = BladesHelpers.resolveActor(conditionalModifier.target);
      let actorActionRating = actorFull.getRollData().diceAmount[dialog.attributeName];
      conditionalModifier.dice = targetFull.getRollData().diceAmount[dialog.attributeName] - actorActionRating;
    }

    output.push(conditionalModifier);
  }

  // Fetch hidden, always on modifiers
  for (let modifier of dialog.allConditionalModifiers)
    if (modifier.hidden)
      output.push(modifier);

  return output;
}

// Downtime Rules: Prevent roll if not enough Downtime Activities if Strict
export function checkDowntimeRules(dialog) {
  if (game.settings.get('songs-for-the-dusk', 'DowntimeRules') == 'strict' && dialog.actor) {
    let enabledConditionalModifiers = resolveConditionalModifiers(dialog, dialog.actor);
    enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);
    let modifiers = [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ];

    if (dialog.actor.type == 'strider') {
      let input = dialog.element.querySelector('input[type=radio]:checked');
      if (input) {
        let rollType = input.id.split('-')[0];
        let downtimeCountChanges = rollType ? (BladesHelpers.isDowntime(rollType) ? -1 : 0) : 0;
        for (let modifier of modifiers) {
          if (modifier.bonusRoll) {
            downtimeCountChanges = 0;
            extraFields.bonusRoll = true;
          }
          if (modifier.downtime) downtimeCountChanges += modifier.downtime;
        }

        if (-downtimeCountChanges > dialog.actor.system.downtime_count.value)
          return false;
      } else
        return false;
    } else if (dialog.actor.type == 'crew') {
      // Specialist Rolls
      if (dialog.actor.system.specialist_downtime_done)
        return false;
    }
  }
  return true;
}

export async function postRollProcessing(actor, extraFields) {
  // Decrease uses for itemNeeded modifiers
  for (let modifier of extraFields.modifiers) {
    if (modifier.itemNeeded) {
      let exhaustableItems = actor.items.filter(i => i.system[modifier.itemNeeded] && i.system.uses.value > 0);
      if (exhaustableItems.length > 0)
        await BladesHelpers.tryUpdate(exhaustableItems[0], {system: {uses: {'==value': exhaustableItems[0].system.uses.value - 1}}});
    }
    if (modifier.convictionCutLoose)
      await BladesHelpers.tryUpdate(actor, {system: {conviction_uses: {'==value': Math.min(Number(actor.system.conviction_uses.value) + 1, actor.system.conviction_uses.max)}}});
    if (modifier.convictionExtra)
      await BladesHelpers.tryUpdate(actor, {system: {conviction_uses: {'==value': Math.max(Number(actor.system.conviction_uses.value) - 1, 0)}}});
  }
}

export async function computeGroupActionResultAndSendMessage(groupActionData, crewFull) {
  const action_label = BladesHelpers.getRollLabel(groupActionData.action);

  if (Object.values(groupActionData.rolls).length == 0) {
    ui.notifications.warn(game.i18n.localize('SFTD.log.warn.GroupActionNoRollsToParse'));
    return;
  }

  let result = Object.values(groupActionData.rolls).sort((a, b) => rollResultIndex.indexOf(b) - rollResultIndex.indexOf(a))[0];
  // Coordinated: Prevent failed rolls to count for stress gain
  let rolls = Object.fromEntries(Object.entries(foundry.utils.deepClone(groupActionData.rolls))
    .map(r => [ BladesHelpers.resolveActor(r[0]), r[1] ])
    .filter(r => r[0] && (r[1] != 'failure' || !r[0].system.coordinated))
  );

  const resultOccurrences = Object.values(rolls).reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;
    return acc;
  }, {});

  // Synchronized: Count separate 6s (success) for a critical success
  if (crewFull.system.synchronized && result == 'success' && resultOccurrences['success'] >= 2)
    result = 'critical-success';

  const leaderFull = BladesHelpers.resolveActor(groupActionData.leader);
  let stress = resultOccurrences['failure'] ?? 0;

  // Mother Duck: Divide stress by 2 if action is Wayfare, Shadow or Trace
  if (leaderFull.system.mother_duck && ['wayfare', 'shadow', 'trace'].includes(groupActionData.action))
    stress = Math.floor(stress / 2);

  // Expertise: If leader's selected action, max stress at 1
  for (let expertise of leaderFull.items.filter(i => i.system.expertise == true))
    if (expertise.system.expertise_action == groupActionData.action) {
      stress = Math.min(stress, 1);
      break;
    }

  let resultStress = Math.max(Math.min(Number(leaderFull.system.stress.value) + stress, Number(leaderFull.system.stress.max)), 0);
  if (resultStress != leaderFull.system.stress.value)
    await BladesHelpers.tryUpdate(leaderFull, {system: {stress: {'==value': resultStress}}});

  let speaker = {
    actor: crewFull._id,
    alias: crewFull.name,
    scene: null,
    token: crewFull.prototypeToken._id
  };

  let messageData = {
    speaker: speaker,
    content: await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/group-action-result.html', { action: action_label, position: groupActionData.position, impact: groupActionData.impact, roll_status: result, leader_name: leaderFull.name, stress: stress, note: groupActionData.note })
  };
  SFTDChatMessage.create(messageData);
}

export async function computeCutLooseResultAndSendMessage(cutLooseData, crewFull) {
  if (Object.values(cutLooseData.rolls).length == 0) {
    ui.notifications.warn(game.i18n.localize('SFTD.log.warn.CutLooseNoRollsToParse'));
    return;
  }

  const rollStatus = Object.values(cutLooseData.rolls).map(r => r.result).includes('failure') ? 'failure' : 'success';
  const resultArray = Object.entries(cutLooseData.rolls).map(r => { return {strider: BladesHelpers.resolveActor(`Actor.${r[0]}`), stress: r[1].stress}; }).filter(r => r.strider);

  let stressText = '';
  let beliefClockFull = false;
  for (const result of resultArray) {
    let striderUpdateObject = {'system.stress.==value': Math.clamp(result.strider.system.stress.value - result.stress, 0, result.strider.system.stress.max) };
    stressText += game.i18n.format(`SFTD.RollCutLooseResultStress`, {strider: result.strider.name, stress: result.stress});
    striderUpdateObject['system.belief.clock.==value'] = (result.strider.system.belief.clock.value + 1) % result.strider.system.belief.clock.max;
    if (striderUpdateObject['system.belief.clock.==value'] < result.strider.system.belief.clock.value) {
      stressText += ' ' + game.i18n.localize(`SFTD.RollCutLooseResultBeliefFull`);
      beliefClockFull = true;
    }
    await BladesHelpers.tryUpdate(result.strider, striderUpdateObject);
    stressText += '<br/>';
  }
  if (stressText != '')
    stressText = stressText.slice(0, -5);

  const speaker = {
    actor: crewFull._id,
    alias: crewFull.name,
    scene: null,
    token: crewFull.prototypeToken._id
  };
  const messageData = {
    speaker: speaker,
    content: await renderTemplate('systems/songs-for-the-dusk/templates/chat/rolls/downtime/cut-loose-result.html', { roll_status: rollStatus, stress_text: stressText, belief_clock_full: beliefClockFull, note: cutLooseData.note })
  };
  SFTDChatMessage.create(messageData);
}
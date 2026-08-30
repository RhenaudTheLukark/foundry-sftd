import { renderHandlebarsTemplate as renderTemplate } from "./compat.js";
import { openFormDialog } from "./lib/dialog-compat.js";
import { BladesHelpers } from "./blades-helpers.js";

export class BladesPopup {
  static async instantiatePopup(actorFull, itemFull, popupData) {
    const popupFields = foundry.utils.deepClone(popupData.fields ?? {});
    if (actorFull.isCharmworkAvailable() && popupData.stress)
      popupFields.charmwork = {
        name: 'SFTD.StriderAbility.Charmwork.Title',
        type: 'checkbox'
      };

    const title = popupData.title ?? 'SFTD.UseAbility';
    const preContent = popupData.pre_content ? popupData.pre_content({}) : '';
    const form = Object.keys(popupFields).length ? BladesPopup.instantiatePopupForm(actorFull, popupFields, title) : '';
    if (form == null)
      return;
    const postContent = popupData.post_content ? popupData.post_content({}) : '';

    const fields = {self: actorFull.uuid, itemFull: itemFull};
    if (form == '') {
      if (popupData.validation)
        if (!popupData.validation(fields, popupData, true))
          return;
      if (popupData.effect)
        await popupData.effect(fields, popupData);
      if (popupData.message)
        await BladesPopup.sendMessage(fields, popupData);
      return;
    } else if (popupData.pre_validation)
      if (!popupData.pre_validation(fields, popupData, true))
        return;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize(title)}` },
      content: await renderTemplate('systems/songs-for-the-dusk/templates/popups/generic-popup.html', { title: title, description: popupData.description, pre_content: preContent, form: form, post_content: postContent }),
      classes: ['generic-popup', ...popupData.classes ?? []],
      buttons: [
        {
          icon: `fas ${popupData.icon ?? 'fa-people-arrows'}`,
          label: game.i18n.localize('SFTD.Use'),
          action: 'use',
          disabled: true
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel'
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'use') return;

        let fields = BladesPopup.fetchFormValues(dialog);
        if (dialog.popupData.effect)
          await dialog.popupData.effect(fields, dialog.popupData);
        if (dialog.itemFull.system.uses.value > 0)
          await BladesHelpers.tryUpdate(itemFull, { 'system.uses.==value': itemFull.system.uses.value - 1})
        if (dialog.popupData.message)
          await BladesPopup.sendMessage(fields, dialog.popupData);
      }
    });
    dialog.popupData = popupData;
    dialog.itemFull = itemFull;

    await dialog.render(true);

    BladesPopup.setupFormEvents(dialog);
    BladesPopup.updateFormValues(dialog);
  }

  static instantiatePopupForm(actorFull, fields, popupName) {
    let result = `<div class="field" data-field="self" data-value="${actorFull.uuid}" style="display: none;"></div>`;
    for (let [fieldName, fieldData] of Object.entries(fields)) {
      let isInline = ['checkbox'].includes(fieldData.type);
      let fieldContainer = `<div class="field flex-${isInline ? 'horizontal shrink' : 'vertical'}" data-field="${fieldName}" data-type="${fieldData.type}">`;
      if (fieldData.name)
        fieldContainer += `<label>${game.i18n.localize(fieldData.name)}</label>`;
      switch (fieldData.type) {
        case 'crewmate':
          let crewFull = BladesHelpers.resolveActor(actorFull.system.crew);
          if (!crewFull) {
            ui.notifications.warn(game.i18n.format('SFTD.log.warn.GenericPopupNoCrew', {name: game.i18n.localize(popupName)}));
            return null;
          }
          let otherMembers = Object.values(crewFull.system.members).map(m => BladesHelpers.resolveActor(m.uuid)).filter(m => m != null && m.type == 'strider');
          if (fieldData.modifiers) {
            if (fieldData.modifiers.includes('excludeUser'))
              otherMembers = otherMembers.filter(m => m.uuid != actorFull.uuid);
            if (fieldData.modifiers.includes('needsStress'))
              otherMembers = otherMembers.filter(m => m.system.stress.value > 0);
            if (fieldData.modifiers.includes('needsAnyStress'))
              otherMembers = otherMembers.filter(m => actorFull.system.stress.value > 0 || m.system.stress.value > 0);
            if (fieldData.modifiers.includes('needsHarm'))
              otherMembers = otherMembers.filter(m => m.system.harm.light.one != '' || m.system.harm.light.two != '' || m.system.harm.medium.one != '' || m.system.harm.medium.two != '' || m.system.harm.heavy.one != '' || m.system.harm.deadly.one != '');
          }
          if (!otherMembers.length) {
            ui.notifications.warn(game.i18n.format('SFTD.log.warn.GenericPopupNoValidCrewmate', {name: game.i18n.localize(popupName)}));
            return null;
          }
          fieldContainer += `
            <table class="form-group crewmate-group">
              ${otherMembers.map((member, i) => `${i % 2 == 0 ? '<tr>' : ''}<td class="actor-cell flex-equal" data-actor-id="${member.uuid}">
                <div class="actor-contents flex-horizontal">
                  <img src="${member.img}" data-tooltip="${member.name}" width="48" height="48"/>
                  <a class="item-name">${member.name}</a>
                </div>
              </td>${(i % 2 == 1 || i == otherMembers.length - 1) ? '</tr>' : ''}`).join('')}
            </table>`;
          break;
        case 'checkbox':
          fieldContainer += `<input type="checkbox">`;
          break;
        default:
          break;
      }
      result += fieldContainer + '</div>';
    }
    return result;
  }

  static setupFormEvents(dialog) {
    for (let element of dialog.element.querySelectorAll('.field .crewmate-group .actor-cell')) {
      element.addEventListener('click', async function(ev) {
        let previousSelected = ev.currentTarget.closest('.crewmate-group').querySelector('.selected');
        if (previousSelected)
          previousSelected.classList.remove('selected');
        ev.currentTarget.classList.add('selected');
        BladesPopup.updateFormValues(dialog);
      });
    }
    for (let element of dialog.element.querySelectorAll('.field > input[type="checkbox"]')) {
      element.addEventListener('click', async function(ev) {
        BladesPopup.updateFormValues(dialog);
      });
    }
  }

  static fetchFormValues(dialog) {
    let fields = { itemFull: dialog.itemFull };
    for (let element of dialog.element.querySelectorAll('.form .field')) {
      if (element.dataset.value)
        fields[element.dataset.field] = element.dataset.value;
      else
        switch (element.dataset.type) {
          case 'crewmate':
            let selectedCell = element.querySelector('.actor-cell.selected');
            let crewmate = selectedCell ? selectedCell.dataset.actorId : null;
            fields[element.dataset.field] = crewmate;
            break;
          case 'checkbox':
            fields[element.dataset.field] = element.querySelector('input[type="checkbox"]').checked;
            break;
          default:
            break;
        }
    }
    return fields;
  }

  static updateFormValues(dialog) {
    const fields = BladesPopup.fetchFormValues(dialog);
    dialog.element.querySelector('.pre-content').innerHTML = dialog.popupData.pre_content ? dialog.popupData.pre_content(fields) : '';
    dialog.element.querySelector('.post-content').innerHTML = dialog.popupData.post_content ? dialog.popupData.post_content(fields) : '';
    dialog.element.querySelector('button[data-action="use"]').disabled = dialog.popupData.validation ? !dialog.popupData.validation(fields, dialog.popupData ?? {}) : false;
  }

  /* ----------------------------------------- */

  static async sendMessage(fields, popupData) {
    const messageData = popupData.message;
    const extraFields = {
      title: game.i18n.localize(messageData.title ?? 'SFTD.UseAbility'),
      contents: messageData.contents ? messageData.contents(fields, popupData) : BladesPopup.defaultMessageContents(fields, popupData)
    };

    const selfFull = BladesHelpers.resolveActor(fields.self);
    const speaker = {
      actor: selfFull._id,
      alias: selfFull.name,
      scene: null,
      token: selfFull.prototypeToken._id
    };
    const newMessageData = {
      speaker: speaker,
      content: await renderTemplate('systems/songs-for-the-dusk/templates/chat/generic-message.html', { extraFields: extraFields })
    }
    await ChatMessage.create(newMessageData);
  }

  static defaultMessageContents(fields, popupData) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    return game.i18n.format(popupData.message?.description ?? '', {self: selfFull.name});
  }

  static defaultGetStress(fields, baseStress, fieldsData) {
    let stressGain = baseStress;
    for (let [fieldName, fieldData] of Object.entries(fieldsData).filter(f => fields[f[0]] && f[1].stress != undefined))
      stressGain += fieldData.stress;
    return stressGain;
  }

  /* ----------------------------------------- */

  static simpleStressAbilityValidation(fields, popupData, noPopup) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    const stressGain = BladesPopup.defaultGetStress(fields, popupData.stress ?? 0, popupData.fields ?? {});
    const selfNewStress = selfFull.system.stress.value + stressGain;
    const hasCharmwork = selfFull.isCharmworkAvailable();
    if (noPopup && selfNewStress > selfFull.system.stress.max && !hasCharmwork)
      ui.notifications.warn(game.i18n.format('SFTD.log.warn.SimpleStressAbilityTooMuchStress', { name: game.i18n.localize(popupData.title ?? 'SFTD.UseAbility') }));
    return selfNewStress <= selfFull.system.stress.max || (hasCharmwork && fields.charmwork);
  }


  static async simpleStressAbilityEffect(fields, popupData) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    const crewFull = BladesHelpers.resolveActor(selfFull.system.crew);
    if (fields.charmwork)
      await BladesHelpers.tryUpdate(crewFull, {'system.harmony.==value': crewFull.system.harmony.value - 1 });
    else
      await BladesHelpers.tryUpdate(selfFull, {'system.stress.==value': selfFull.system.stress.value + BladesPopup.defaultGetStress(fields, popupData.stress ?? 0, popupData.fields ?? {})});
  }

  static simpleStressAbilityMessageContents(fields, popupData) {
    const stress = BladesPopup.defaultGetStress(fields, popupData.stress ?? 0, popupData.fields ?? {});
    let effects = '';
    if (popupData.fields)
      for (let [fieldName, fieldData] of Object.entries(popupData.fields).filter(f => fields[f[0]] && f[1].message_text != undefined))
        effects += game.i18n.localize(fieldData.message_text);
    return game.i18n.format(popupData.message?.description ?? '', {
      effects: effects,
      cost: game.i18n.format(`SFTD.StriderAbility.Charmwork.${fields.charmwork ? '' : 'Not'}Usage`, { stress : stress })
    });
  }

  /* ----------------------------------------- */

  static simpleCrewValidation(fields, popupData, noPopup) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    const crewFull = BladesHelpers.resolveActor(selfFull.system.crew);
    if (!crewFull) {
      ui.notifications.warn(game.i18n.format('SFTD.log.warn.GenericPopupNoCrew', {name: game.i18n.localize(popupData.title ?? 'SFTD.UseAbility') }));
      return false;
    }
    return true;
  }

  /* ----------------------------------------- */

  static simpleCrewmateValidation(fields, popupData, noPopup) {
    if (!BladesPopup.simpleCrewValidation(fields, popupData))
      return false;
    if (!fields.crewmate)
      return false;
    return true;
  }

  static simpleCrewmateMessageContents(fields, popupData) {
    const crewmateFull = BladesHelpers.resolveActor(fields.crewmate);
    return game.i18n.format(popupData.message?.description ?? '', { crewmate: crewmateFull.name });
  }

  /* ----------------------------------------- */

  static simpleItemUsesValidation(fields, popupData, noPopup) {
    const hasAnyUses = fields.itemFull.system.uses.value > 0;
    if (!hasAnyUses)
      ui.notifications.warn(game.i18n.format('SFTD.log.warn.GenericPopupNoUses', { name: game.i18n.localize(popupData.title) }));
    return hasAnyUses;
  }

  /* ----------------------------------------- */

  static simpleMelodyValidation(fields, popupData, noPopup) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    if (!selfFull.system.melody)
      ui.notifications.warn(game.i18n.format('SFTD.log.warn.GenericPopupNoMelody', { name: game.i18n.localize(popupData.title) }));
    return selfFull.system.melody;
  }

  /* ----------------------------------------- */

  static alloyedMettlePostContent(fields) {
    if (!fields.crewmate)
      return '';
    const selfFull = BladesHelpers.resolveActor(fields.self);
    const selfNewStress = selfFull.system.stress.value + (fields.reverse ? -1 : 1);
    const selfRed = selfNewStress >= selfFull.system.stress.max;
    const crewmateFull = BladesHelpers.resolveActor(fields.crewmate);
    const crewmateNewStress = crewmateFull.system.stress.value + (fields.reverse ? 1 : -1);
    const crewmateRed = crewmateNewStress >= crewmateFull.system.stress.max;
    return `
      <div class="stress-transfer flex-horizontal">
        <div class="actor-stress flex-vertical flex-equal">
          <label>${selfFull.name}</label>
          <label class="stress${selfRed ? ' maxxed' : ''}">${selfFull.system.stress.value}/${selfFull.system.stress.max} => ${selfNewStress}/${selfFull.system.stress.max}</label>
        </div>
        <div class="selector flex-vertical">
          <label>${fields.reverse ? '=>' : '<='}</label>
        </div>
        <div class="other-stress flex-vertical flex-equal">
          <label>${crewmateFull.name}</label>
          <label class="stress${crewmateRed ? ' maxxed' : ''}">${crewmateFull.system.stress.value}/${crewmateFull.system.stress.max} => ${crewmateNewStress}/${crewmateFull.system.stress.max}</label>
        </div>
      </div>`;
  }

  static alloyedMettleValidation(fields, popupData) {
    if (!BladesPopup.simpleCrewmateValidation(fields, popupData))
      return false;
    const selfFull = BladesHelpers.resolveActor(fields.self);
    const selfNewStress = selfFull.system.stress.value + (fields.reverse ? -1 : 1);
    const crewmateFull = BladesHelpers.resolveActor(fields.crewmate);
    const crewmateNewStress = crewmateFull.system.stress.value + (fields.reverse ? 1 : -1);
    return selfNewStress >= 0 && selfNewStress <= selfFull.system.stress.max && crewmateNewStress >= 0 && crewmateNewStress <= crewmateFull.system.stress.max;
  }

  static async alloyedMettleEffect(fields) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    const crewmateFull = BladesHelpers.resolveActor(fields.crewmate);
    await BladesHelpers.tryUpdate(selfFull, {'system.stress.==value': selfFull.system.stress.value + (fields.reverse ? -1 : 1)});
    await BladesHelpers.tryUpdate(crewmateFull, {'system.stress.==value': crewmateFull.system.stress.value + (fields.reverse ? 1 : -1)});
  }

  static alloyedMettleMessageContents(fields, popupData) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    const crewmateFull = BladesHelpers.resolveActor(fields.crewmate);
    return game.i18n.format('SFTD.StriderAbility.AlloyedMettle.Message.Description', {
      stressGiver: fields.reverse ? selfFull.name : crewmateFull.name,
      stressTaker: fields.reverse ? crewmateFull.name : selfFull.name
    });
  }

  /* ----------------------------------------- */

  static async flowAndCrashEffect(fields) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    if (selfFull.system.stress.value > 0)
      await BladesHelpers.tryUpdate(selfFull, {'system.stress.==value': selfFull.system.stress.value - 1});
  }

  /* ----------------------------------------- */

  static charmsyncValidation(fields, popupData, noPopup) {
    const stressRequirement = BladesPopup.simpleStressAbilityValidation(fields, popupData, noPopup);
    const fieldEntries = Object.entries(popupData.fields ?? {});
    if (!fieldEntries.find(f => fields[f[0]] && f[1].stress != undefined))
      return false;
    return stressRequirement;
  }

  /* ----------------------------------------- */

  static longThoughtValidation(fields, popupData) {
    if (!BladesPopup.simpleCrewValidation(fields, popupData))
      return false;

    const selfFull = BladesHelpers.resolveActor(fields.self);
    const crewFull = BladesHelpers.resolveActor(selfFull.system.crew);
    if (crewFull.system.harmony.value <= 0)
      ui.notifications.warn(game.i18n.localize('SFTD.log.warn.LongThoughtNoHarmony'));
    return crewFull.system.harmony.value > 0;
  }

  static async longThoughtEffect(fields) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    const crewFull = BladesHelpers.resolveActor(selfFull.system.crew);
    await BladesHelpers.tryUpdate(crewFull, {'system.harmony.==value': crewFull.system.harmony.value - 1});
  }

  /* ----------------------------------------- */

  static async makingTimeEffect(fields) {
    const crewmateFull = BladesHelpers.resolveActor(fields.crewmate);
    await BladesHelpers.tryUpdate(crewmateFull, {'system.downtime_count.==value': crewmateFull.system.downtime_count.value + 1});
  }

  /* ----------------------------------------- */

  static hallowlinkHealingNotePreValidation(fields, popupData) {
    return BladesPopup.simpleMelodyValidation(fields, popupData) && BladesPopup.simpleCrewValidation(fields, popupData);
  }
}

export const bladesPopupData = {
  alloyed_mettle: {
    title: 'SFTD.StriderAbility.AlloyedMettle.Popup.Title',
    description: 'SFTD.StriderAbility.AlloyedMettle.Popup.Description',
    classes: ['alloyed-mettle'],
    pre_content: null,
    fields: {
      crewmate: {
        type: 'crewmate',
        modifiers: ['excludeUser', 'needsAnyStress']
      },
      reverse: {
        name: 'SFTD.StriderAbility.AlloyedMettle.Popup.ReverseArgName',
        type: 'checkbox'
      }
    },
    post_content: BladesPopup.alloyedMettlePostContent,
    validation: BladesPopup.alloyedMettleValidation,
    effect: BladesPopup.alloyedMettleEffect,
    message: {
      title: 'SFTD.StriderAbility.AlloyedMettle.Message.Title',
      contents: BladesPopup.alloyedMettleMessageContents
    }
  },
  charmguard: {
    title: 'SFTD.StriderAbility.Charmguard.Popup.Title',
    description: 'SFTD.StriderAbility.Charmguard.Popup.Description',
    stress: 2,
    validation: BladesPopup.simpleStressAbilityValidation,
    effect: BladesPopup.simpleStressAbilityEffect,
    message: {
      title: 'SFTD.StriderAbility.Charmguard.Message.Title',
      description: 'SFTD.StriderAbility.Charmguard.Message.Description',
      contents: BladesPopup.simpleStressAbilityMessageContents
    }
  },
  flow_and_crash: {
    effect: BladesPopup.flowAndCrashEffect,
    message: {
      title: 'SFTD.StriderAbility.FlowAndCrash.Message.Title',
      description: 'SFTD.StriderAbility.FlowAndCrash.Message.Description',
    }
  },
  charmtongue: {
    title: 'SFTD.StriderAbility.Charmtongue.Popup.Title',
    description: 'SFTD.StriderAbility.Charmtongue.Popup.Description',
    classes: ['charmtongue'],
    pre_content: null,
    fields: {
      stable: {
        name: 'SFTD.StriderAbility.Charmtongue.Popup.StableArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.Charmtongue.Message.Stable'
      },
      no_radiation: {
        name: 'SFTD.StriderAbility.Charmtongue.Popup.NoRadiationArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.Charmtongue.Message.NoRadiation'
      },
      no_change: {
        name: 'SFTD.StriderAbility.Charmtongue.Popup.NoChangeArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.Charmtongue.Message.NoChange'
      }
    },
    stress: 2,
    validation: BladesPopup.simpleStressAbilityValidation,
    effect: BladesPopup.simpleStressAbilityEffect,
    message: {
      title: 'SFTD.StriderAbility.Charmtongue.Message.Title',
      description: 'SFTD.StriderAbility.Charmtongue.Message.Description',
      contents: BladesPopup.simpleStressAbilityMessageContents
    }
  },
  the_moon_upright: {
    title: 'SFTD.StriderAbility.TheMoonUpright.Popup.Title',
    description: 'SFTD.StriderAbility.TheMoonUpright.Popup.Description',
    classes: ['the-moon-upright'],
    pre_content: null,
    fields: {
      wide_effect: {
        name: 'SFTD.StriderAbility.TheMoonUpright.Popup.WideEffectArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.TheMoonUpright.Message.WideEffect'
      },
      no_focus: {
        name: 'SFTD.StriderAbility.TheMoonUpright.Popup.NoFocusArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.TheMoonUpright.Message.NoFocus'
      },
      vague_memories: {
        name: 'SFTD.StriderAbility.TheMoonUpright.Popup.VagueMemoriesArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.TheMoonUpright.Message.VagueMemories'
      }
    },
    stress: 2,
    validation: BladesPopup.simpleStressAbilityValidation,
    effect: BladesPopup.simpleStressAbilityEffect,
    message: {
      title: 'SFTD.StriderAbility.TheMoonUpright.Message.Title',
      description: 'SFTD.StriderAbility.TheMoonUpright.Message.Description',
      contents: BladesPopup.simpleStressAbilityMessageContents
    }
  },
  charmsync: {
    title: 'SFTD.StriderAbility.Charmsync.Popup.Title',
    description: 'SFTD.StriderAbility.Charmsync.Popup.Description',
    classes: ['charmsync'],
    fields: {
      setup: {
        name: 'SFTD.StriderAbility.Charmsync.Popup.SetupArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.Charmsync.Message.Setup'
      },
      push: {
        name: 'SFTD.StriderAbility.Charmsync.Popup.PushArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.Charmsync.Message.Push'
      },
      protect: {
        name: 'SFTD.StriderAbility.Charmsync.Popup.ProtectArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.Charmsync.Message.Protect'
      }
    },
    stress: 1,
    validation: BladesPopup.charmsyncValidation,
    effect: BladesPopup.simpleStressAbilityEffect,
    message: {
      title: 'SFTD.StriderAbility.Charmsync.Message.Title',
      description: 'SFTD.StriderAbility.Charmsync.Message.Description',
      contents: BladesPopup.simpleStressAbilityMessageContents
    }
  },
  long_thought: {
    validation: BladesPopup.longThoughtValidation,
    effect: BladesPopup.longThoughtEffect,
    message: {
      title: 'SFTD.StriderAbility.LongThought.Message.Title',
      description: 'SFTD.StriderAbility.LongThought.Message.Description',
    }
  },
  making_time: {
    title: 'SFTD.StriderAbility.MakingTime.Popup.Title',
    description: 'SFTD.StriderAbility.MakingTime.Popup.Description',
    pre_validation: BladesPopup.simpleItemUsesValidation,
    classes: ['making-time'],
    fields: {
      crewmate: {
        type: 'crewmate'
      }
    },
    validation: BladesPopup.simpleCrewmateValidation,
    effect: BladesPopup.makingTimeEffect,
    message: {
      title: 'SFTD.StriderAbility.MakingTime.Message.Title',
      contents: BladesPopup.simpleCrewmateMessageContents
    }
  },
  charmveil: {
    title: 'SFTD.StriderAbility.Charmveil.Popup.Title',
    description: 'SFTD.StriderAbility.Charmveil.Popup.Description',
    classes: ['charmveil'],
    fields: {
      lasting: {
        name: 'SFTD.StriderAbility.Charmveil.Popup.LastingArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.Charmveil.Message.Lasting'
      },
      wide_effect: {
        name: 'SFTD.StriderAbility.Charmveil.Popup.WideEffectArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.Charmveil.Message.WideEffect'
      },
      awareness: {
        name: 'SFTD.StriderAbility.Charmveil.Popup.AwarenessArgName',
        type: 'checkbox',
        stress: 1,
        message_text: 'SFTD.StriderAbility.Charmveil.Message.Awareness'
      }
    },
    stress: 2,
    validation: BladesPopup.simpleStressAbilityValidation,
    effect: BladesPopup.simpleStressAbilityEffect,
    message: {
      title: 'SFTD.StriderAbility.Charmveil.Message.Title',
      description: 'SFTD.StriderAbility.Charmveil.Message.Description',
      contents: BladesPopup.simpleStressAbilityMessageContents
    }
  },
  hallowlink_healing_note: {
    title: 'SFTD.StriderAbility.HallowlinkHealingNote.Popup.Title',
    description: 'SFTD.StriderAbility.HallowlinkHealingNote.Popup.Description',
    pre_validation: BladesPopup.hallowlinkHealingNotePreValidation,
    classes: ['hallowlink-healing-note'],
    fields: {
      crewmate: {
        type: 'crewmate',
        modifiers: ['needsHarm']
      }
    },
    validation: BladesPopup.simpleCrewmateValidation,
    message: {
      title: 'SFTD.StriderAbility.HallowlinkHealingNote.Message.Title',
      description: 'SFTD.StriderAbility.HallowlinkHealingNote.Message.Description',
      contents: BladesPopup.simpleCrewmateMessageContents
    }
  },
}
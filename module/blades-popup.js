import { renderHandlebarsTemplate as renderTemplate } from "./compat.js";
import { openFormDialog } from "./lib/dialog-compat.js";
import { BladesHelpers } from "./blades-helpers.js";
import { SFTDChatMessage } from "./messages/sftd-chat-message.js";

export class BladesPopup {
  static async instantiatePopup(actorFull, popupData) {
    let title = popupData.title ?? 'SFTD.UseAbility';
    let preContent = popupData.pre_content ? popupData.pre_content({}) : '';
    let form = popupData.fields ? BladesPopup.instantiatePopupForm(actorFull, popupData.fields, title) : '';
    if (form == null)
      return;
    let postContent = popupData.post_content ? popupData.post_content({}) : '';

    if (form == '') {
      let fields = {self: actorFull.uuid};
      if (popupData.validation)
        if (!popupData.validation(fields, popupData, true))
          return;
      if (popupData.effect)
        await popupData.effect(fields, popupData);
      if (popupData.message)
        await BladesPopup.sendMessage(fields, popupData);
      return;
    }

    let dialog = new foundry.applications.api.DialogV2({
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
        if (dialog.popupData.message)
          await BladesPopup.sendMessage(fields, dialog.popupData);
      }
    });
    dialog.popupData = popupData;

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
          let hasStress = actorFull.system.stress.value > 0;
          let otherMembers = Object.values(crewFull.system.members).filter(m => m.uuid != actorFull.uuid).map(m => BladesHelpers.resolveActor(m.uuid)).filter(m => m != null && m.type == 'strider' && (hasStress || m.system.stress.value > 0));
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
    let fields = {};
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
    await SFTDChatMessage.create(newMessageData);
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
    let stressGain = BladesPopup.defaultGetStress(fields, popupData.stress ?? 0, popupData.fields ?? {});
    const selfNewStress = selfFull.system.stress.value + stressGain;
    if (noPopup && selfNewStress > selfFull.system.stress.max)
      ui.notifications.warn(game.i18n.format('SFTD.log.warn.SimpleStressAbilityTooMuchStress', { name: game.i18n.localize(popupData.title ?? 'SFTD.UseAbility') }));
    return selfNewStress <= selfFull.system.stress.max;
  }


  static async simpleStressAbilityEffect(fields, popupData) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    await BladesHelpers.tryUpdate(selfFull, {'system.stress.==value': selfFull.system.stress.value + BladesPopup.defaultGetStress(fields, popupData.stress ?? 0, popupData.fields ?? {})});
  }

  static simpleStressAbilityMessageContents(fields, popupData) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    let stress = BladesPopup.defaultGetStress(fields, popupData.stress ?? 0, popupData.fields ?? {});
    let effects = '';
    if (popupData.fields)
      for (let [fieldName, fieldData] of Object.entries(popupData.fields).filter(f => fields[f[0]] && f[1].message_text != undefined))
        effects += game.i18n.localize(fieldData.message_text);
    return game.i18n.format(popupData.message.description, { effects: effects, stress: stress });
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

  static alloyedMettleValidation(fields) {
    if (!fields.crewmate)
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

  static longThoughtValidation(fields) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    const crewFull = BladesHelpers.resolveActor(selfFull.system.crew);
    if (!crewFull) {
      ui.notifications.warn(game.i18n.format('SFTD.log.warn.GenericPopupNoCrew', {name: game.i18n.localize('SFTD.StriderAbility.LongThought.Message.Title')}));
      return false;
    }
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

  static async flowAndCrashEffect(fields) {
    const selfFull = BladesHelpers.resolveActor(fields.self);
    if (selfFull.system.stress.value > 0)
      await BladesHelpers.tryUpdate(selfFull, {'system.stress.==value': selfFull.system.stress.value - 1});
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
        type: 'crewmate'
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
    title: 'SFTD.StriderAbility.Charmguard.Message.Title',
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
    classes: ['the_moon_upright'],
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
  long_thought: {
    validation: BladesPopup.longThoughtValidation,
    effect: BladesPopup.longThoughtEffect,
    message: {
      title: 'SFTD.StriderAbility.LongThought.Message.Title',
      description: 'SFTD.StriderAbility.LongThought.Message.Description',
    }
  }
}
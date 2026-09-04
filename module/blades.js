/**
 * A simple and flexible system for world-building using an arbitrary collection of strider and item attributes
 * Author: Atropos
 * Software License: GNU GPLv3
 */

// Import Modules
import { registerSystemSettings } from "./settings.js";
import { registerSystemKeybinds } from "./keybinds.js";
import { preloadHandlebarsTemplates } from "./blades-templates.js";
import { bladesRoll, simpleRollPopup, cancelRollResult, computeGroupActionResultAndSendMessage } from "./blades-roll.js";
import { BladesHelpers } from "./blades-helpers.js";
import { BladesActor } from "./blades-actor.js";
import { BladesItem } from "./blades-item.js";
import { BladesItemSheet } from "./blades-item-sheet.js";
import { BladesStriderSheet } from "./blades-strider-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { ClockStylesSettings } from "./settings/clock-styles.js";
import { BladesCrewSheet } from "./blades-crew-sheet.js";
import { BladesClockSheet } from "./blades-clock-sheet.js";
import { BladesNPCSheet } from "./blades-npc-sheet.js";
import { BladesFactionSheet } from "./blades-faction-sheet.js";
import { SFTDChatMessage } from "./messages/sftd-chat-message.js";
import * as migrations from "./migration.js";
import { getActorSheetClass, getItemSheetClass, registerActorSheet, unregisterActorSheet, registerItemSheet, unregisterItemSheet } from "./compat.js";
import { migrateWorld } from "./migration.js";

window.BladesHelpers = BladesHelpers;

foundry.applications.sidebar.tabs.ActorDirectory.prototype._canDragStart = function(selector) {
  let keyToNumber = ['', 'all', 'trusted', 'gms', 'gm-only'];
  return game.user.role >= keyToNumber.indexOf(game.settings.get('songs-for-the-dusk', 'ActorDragAndDrop'));
}

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
Hooks.once("init", async function() {
  console.log(`Initializing Blades In the Dark System`);

  game.blades = {
    dice: bladesRoll,
	  roller: simpleRollPopup
  };
  game.system.bladesClocks = {
    sizes: [ 4, 6, 8, 10, 12 ]
  };

  CONFIG.Item.documentClass = BladesItem;
  CONFIG.Actor.documentClass = BladesActor;
  CONFIG.ActiveEffect.documentClass = BladesActiveEffect;
  CONFIG.ChatMessage.documentClass = SFTDChatMessage;

  // Register System Settings
  registerSystemSettings();
  registerSystemKeybinds();

  if (game.settings.get('songs-for-the-dusk', "PublicClocks")) {
	  Hooks.on("preCreateActor", (actor, createData, options, userId) => {
		  if (actor.type === "\uD83D\uDD5B clock") {
			  actor.updateSource({
				  'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
			  });
		  }
	  });
  }

  // Multiboxes.
  Handlebars.registerHelper('multiboxes', function(selected, options) {
    let html = options.fn(this);

    // Fix for single non-array values.
    if (!Array.isArray(selected))
      selected = [selected];

    if (typeof selected !== 'undefined') {
      selected.forEach(selected_value => {
        if (selected_value !== false) {
          let escapedValue = RegExp.escape(Handlebars.escapeExpression(selected_value));
          let rgx = new RegExp(' value=[\"\']' + escapedValue + '[\"\']');
          let oldHtml = html;
          html = html.replace(rgx, "$& checked");
          while((oldHtml === html) && (escapedValue >= 0)) {
            escapedValue--;
            rgx = new RegExp(' value=[\"\']' + escapedValue + '[\"\']');
            html = html.replace(rgx, "$& checked");
          }
        }
      });
    }
    return html;
  });

  // Negative multiboxes
  Handlebars.registerHelper('negative-multiboxes', function (selected, options) {
    let html = options.fn(this);
    // Fix for single non-array values.
    if (!Array.isArray(selected))
      selected = [selected];

    if (typeof selected !== 'undefined') {
      selected.forEach(selected_value => {
        if (selected_value !== false) {
          let escapedValue = RegExp.escape(Handlebars.escapeExpression(selected_value));
          let rgx = new RegExp('value=[\"\']' + escapedValue + '[\"\']');
          let oldHtml = html;
          html = html.replace(rgx, "$& checked");
          while ((oldHtml === html) && (escapedValue != 0)) {
            if (escapedValue > 0)
              escapedValue++;
            else
              escapedValue--;
            rgx = new RegExp('value=[\"\']' + escapedValue + '[\"\']');
            html = html.replace(rgx, "$& checked");
          }
        }
      });
    }
    return html;
  });

  Handlebars.registerHelper('lteq', (a, b) => a <= b);
  Handlebars.registerHelper('gteq', (a, b) => a >= b);

  Handlebars.registerHelper('oneless', (a) => Number(a) - 1);

  Handlebars.registerHelper('add', (a, b) => Number(a) + Number(b));
  Handlebars.registerHelper('minus', (a, b) => Number(a) - Number(b));
  Handlebars.registerHelper('mult', (a, b) => Number(a) * Number(b));

  Handlebars.registerHelper('modulo', (a, b) => Number(a) % Number(b));

  Handlebars.registerHelper('typeof', (a) => typeof a);
  Handlebars.registerHelper('capitalize', (str) => String(str).charAt(0).toUpperCase() + String(str).substr(1).toLowerCase());

  Handlebars.registerHelper('isempty', (a) => a.length == 0);

  // Enrich the HTML replace /n with <br>
  Handlebars.registerHelper('html', (options) => {
    let text = options.hash['text'].replace(/\n/g, "<br />");
    return new Handlebars.SafeString(text);
  });

  // Enrich the HTML replace /n with commas
  Handlebars.registerHelper('html-list', (options) => {
    let text = options.hash['text'].replace(/\n/g, ', ');
    return new Handlebars.SafeString(text);
  });

  // "N Times" loop for handlebars.
  //  Block is executed N times starting from start.
  //
  // Usage:
  // {{#times_from 1 10}}
  //   <span>{{this}}</span>
  // {{/times_from}}
  Handlebars.registerHelper('times_from', function(start, n, block) {
    let accum = '';
    for (let i = start; i <= n; ++i)
      accum += block.fn(i);
    return accum;
  });

  // Concat helper
  // https://gist.github.com/adg29/f312d6fab93652944a8a1026142491b1
  // Usage: (concat 'first 'second')
  Handlebars.registerHelper('concat', function() {
    var outStr = '';
    for (var arg in arguments)
      if (typeof arguments[arg] != 'object')
        outStr += arguments[arg];
    return outStr;
  });


  /**
   * @inheritDoc
   * Takes label from Selected option instead of just plain value.
   */

  Handlebars.registerHelper('selectOptionsWithLabel', function(choices, options) {
    const localize = options.hash['localize'] ?? false;
    let selected = options.hash['selected'] ?? null;
    let blank = options.hash['blank'] || null;
    selected = selected instanceof Array ? selected.map(String) : [String(selected)];

    // Create an option
    const option = (key, label) => {
      if (localize) label = game.i18n.localize(label);
      let isSelected = selected.includes(key);
      html += `<option value="${key}" ${isSelected ? "selected" : ""}>${label}</option>`;
    };

    // Create the options
    let html = "";
    if (blank) option("", blank);
    Object.entries(choices).forEach(e => option(...e));

    return new Handlebars.SafeString(html);
  });

  /**
   * Create appropriate Blades clock
   */
  function handleBladesClock(theme, color, size, valuePath, fill, uniqueId, objPath, isDefaultStyle) {
    let html = '';
    if (!fill || fill === 'null')
      fill = 0;
    if (!color)
      color = "black";
    if (parseInt(fill) > parseInt(size))
      fill = size;

    let clockStyles = BladesHelpers.clockStyles;
    let clockData = clockStyles?.[theme]?.[color]?.[size];
    let clockSpritePath;
    if (!clockData)
      clockSpritePath = 'systems/songs-for-the-dusk/themes/error.png';
    else
      clockSpritePath = `${BladesHelpers.getClockSpritePath(clockData)}${size}clock_${fill}.${clockData.extension}`;

    html += `<div${clockData?.shifted ? ' class="shifted"' : ''}>`;
    html += `<div id="blades-clock-${uniqueId}" class="blades-clock clock-${size} clock-${size}-${fill}">`;

    let zeroChecked = (parseInt(fill) === 0) ? ' checked' : '';
    html += `<input type="radio" value="0" id="clock-0-${uniqueId}}" data-dType="Number" name="${valuePath}"${zeroChecked}>`;

    for (let i = 1; i <= parseInt(size); i++) {
      let checked = (parseInt(fill) === i) ? ' checked' : '';
      html += `
        <input type="radio" value="${i}" id="clock-${i}-${uniqueId}" data-dType="Number" name="${valuePath}"${checked}>
        <label class="radio-toggle"></label>
      `;
    }

    html += `<img src="${clockSpritePath}" data-theme="${theme}" data-color="${color}" data-size="${size}" data-fill="${fill}" onerror="return BladesHelpers.handleClockImageError(event)"/>`;
    if (objPath)
      html += `<a class="clock-style-picker" data-path="${objPath}.theme_color" data-theme-color="${isDefaultStyle ? 'null' : `${theme}/${color}`}"><i class="fas fa-gear"></i></a>`;
    html += `</div></div>`;
    return html;
  }

  // Clocks to add in sheets
  Handlebars.registerHelper('blades-clock', function(theme, color, size, valuePath, fill, uniqueId) {
    return handleBladesClock(theme, color, size, valuePath, fill, uniqueId);
  });
  Handlebars.registerHelper('blades-clock-object', function(clockData, clockDataPath, uniqueId, defaultThemeColor) {
    let theme = clockData.theme;
    let color = clockData.color;
    let isDefaultStyle = false;
    if (clockData.theme_color && clockData.theme_color != 'null') {
      let themeColor = clockData.theme_color.split('/');
      theme = themeColor[0];
      color = themeColor[1];
    }
    if (!theme || !color) {
      defaultThemeColor = defaultThemeColor.split('/');
      theme = defaultThemeColor[0];
      color = defaultThemeColor[1];
      isDefaultStyle = true;
    }
    return handleBladesClock(theme, color, clockData.max, `${clockDataPath}.value`, clockData.value, uniqueId, clockDataPath, isDefaultStyle);
  });

  // Computes clock sizes for a given theme
  Handlebars.registerHelper('clock-sizes', function(clockData, defaultThemeColor) {
    let themeColor = clockData.theme_color;
    if (!themeColor || themeColor == 'null')
      themeColor = defaultThemeColor;
    themeColor = themeColor.split('/');
    let theme = themeColor[0];
    let color = themeColor[1];

    let themeColorSizes = Object.keys(BladesHelpers.clockStyles?.[theme]?.[color] ?? {}).filter(s => s != 'dataReason').map(s => Number(s));
    if (!themeColorSizes.includes(clockData.max)) {
      themeColorSizes.push(clockData.max);
      themeColorSizes.sort((a, b) => a - b);
    }
    return Object.fromEntries(themeColorSizes.map(s => [String(s), String(s)]));
  });

  Handlebars.registerHelper('capitalize', function( string ) {
    return BladesHelpers.capitalize(string);
  });

  // Check for game settings
  Handlebars.registerHelper('getSetting', function( string ) {
	  return (game.settings.get('songs-for-the-dusk', string));
  });

  Handlebars.registerHelper('getEdgeFlaw', function (object, edgeflaw, isEdge) {
    const array = isEdge ? object.system.edges : object.system.flaws;
    return array.includes(edgeflaw);
  });
});

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 * and register sheets. Sheet registration is delayed until the ready hook so the DocumentSheetConfig
 * API and the new foundry.documents collections are guaranteed to exist on V13+ while still
 * allowing the compatibility helpers to fall back on older cores.
 */
Hooks.once("ready", async function() {
  const actorSheetClass = getActorSheetClass();
  const itemSheetClass = getItemSheetClass();

  unregisterActorSheet("core", actorSheetClass);
  registerActorSheet("blades", BladesStriderSheet, { types: ["strider"], makeDefault: true });
  registerActorSheet("blades", BladesCrewSheet, { types: ["crew"], makeDefault: true });
  registerActorSheet("blades", BladesFactionSheet, { types: ["faction"], makeDefault: true });
  registerActorSheet("blades", BladesClockSheet, { types: ["\uD83D\uDD5B clock"], makeDefault: true });
  registerActorSheet("blades", BladesNPCSheet, { types: ["npc"], makeDefault: true });
  unregisterItemSheet("core", itemSheetClass);
  registerItemSheet("blades", BladesItemSheet, {makeDefault: true});
  foundry.documents.collections.WorldSettings.registerSheet("blades", ClockStylesSettings, {});
  await preloadHandlebarsTemplates();


  // Determine whether a system migration is required
  const currentVersion = game.settings.get("songs-for-the-dusk", "systemMigrationVersion");
  const NEEDS_MIGRATION_VERSION = 1.2;
  const needsMigration = currentVersion != NEEDS_MIGRATION_VERSION;

  // Perform the migration
  if (needsMigration && game.user.isGM)
    await migrateWorld(currentVersion, NEEDS_MIGRATION_VERSION);

  // Fetch all clock styles
  await BladesHelpers.loadAllClockStyles();
});

/*
 * Hooks
 */

// getSceneControlButtons
Hooks.on('getSceneControlButtons', controls => {
	if (foundry.utils.isNewerVersion(game.version,13)) {
		controls.tokens.tools.DiceRoller = {
			name: "DiceRoller",
			title: "SFTD.DiceRoller",
			icon: "fas fa-dice",
			onChange: (event, active) => {
				simpleRollPopup();
			},
			button: true
		};
	}
});

Hooks.on("renderSceneControls", async (app, html) => {
	if (foundry.utils.isNewerVersion(13,game.version)) {
	  let dice_roller = $('<li class="scene-control" data-tooltip="Dice Roll"><i class="fas fa-dice"></i></li>');
	  dice_roller.click( async function() {
		  await simpleRollPopup();
	  });
	  html.children().first().append( dice_roller );
	}
});

Hooks.on("renderChatMessageHTML", async (message, html, context) => {
  if (!message.isContentVisible) return;
  // Group Action Begin Message
  if (message.content.includes("roll-group-action")) {
    for (const button of html.querySelectorAll('.roll-group-action')) {
      button.addEventListener('click', async (_) => {
        const speakerFull = ChatMessage.getSpeakerActor(ChatMessage.getSpeaker());
        const crewFull = BladesHelpers.resolveActor(message.system.groupActionCrew);
        if (!speakerFull)
          ui.notifications.warn(game.i18n.localize('SFTD.log.warn.GroupActionRollNoActor'));
        else if (speakerFull.type != 'strider')
          ui.notifications.warn(game.i18n.format('SFTD.log.warn.GroupActionRollNotAStrider', { obj: game.i18n.localize(`TYPES.Actor.${speakerFull.type}`) }));
        else if (speakerFull.system.crew != crewFull?.uuid)
          ui.notifications.warn(game.i18n.format('SFTD.log.warn.GroupActionRollStriderNotInCrew', { char: speakerFull.name, crew: crewFull.name }));
        else
          speakerFull.rollAttributePopup(crewFull.system.group_action.action, crewFull.system.group_action);
      });
    }
    for (const select of html.querySelectorAll('.specialist-block > select'))
      select.addEventListener('change', async (ev) => {
        const element = ev.currentTarget;
        const divElement = element.nextElementSibling;
        const buttonElement = divElement.nextElementSibling.querySelector('button');
        const specialistId = element.value;
        const crewFull = BladesHelpers.resolveActor(message.system.groupActionCrew);
        const specialistFull = crewFull.items.contents[specialistId];
        const noSpecialist = specialistId == 'None';
        divElement.innerHTML = noSpecialist ? '' : `<img src="${specialistFull.img}" data-tooltip="${specialistFull.name}" width="48" height="48"/><div class="name">${specialistFull.name}</div>`;
        buttonElement.disabled = noSpecialist;
      });
    for (const button of html.querySelectorAll('.roll-group-action-specialist')) {
      button.addEventListener('click', async (ev) => {
        const element = ev.currentTarget;
        const specialistId = element.closest('.specialist-block').querySelector('select').value;
        const crewFull = BladesHelpers.resolveActor(message.system.groupActionCrew);
        const specialistFull = crewFull.items.contents[specialistId];
        await crewFull.sheet.createSpecialistRollPopup(specialistFull, crewFull.system.group_action);
      });
    }
    for (const button of html.querySelectorAll('.reveal-group-action-result'))
      button.addEventListener('click', async (_) => BladesHelpers.resolveActor(message.system.groupActionCrew)?.revealGroupActionResult());
  }
  // Cut Loose Begin Message
  if (message.content.includes("roll-cut-loose")) {
    for (const button of html.querySelectorAll('.roll-cut-loose')) {
      button.addEventListener('click', async (_) => {
        const speakerFull = ChatMessage.getSpeakerActor(ChatMessage.getSpeaker());
        const crewFull = BladesHelpers.resolveActor(message.system.cutLooseCrew);
        const cutLooseFull = crewFull?.system?.cut_loose;
        if (!cutLooseFull)
          ui.notifications.error(game.i18n.localize('SFTD.log.error.NoCutLoose'));
        else if (!speakerFull)
          ui.notifications.warn(game.i18n.localize('SFTD.log.warn.CutLooseRollNoActor'));
        else if (speakerFull.type != 'strider')
          ui.notifications.warn(game.i18n.format('SFTD.log.warn.CutLooseRollNotAStrider', { obj: game.i18n.localize(`TYPES.Actor.${speakerFull.type}`) }));
        else if (speakerFull.system.crew != crewFull?.uuid)
          ui.notifications.warn(game.i18n.format('SFTD.log.warn.CutLooseRollStriderNotInCrew', { char: speakerFull.name, crew: crewFull.name }));
        else if (!cutLooseFull.participants.includes(speakerFull.uuid))
          ui.notifications.warn(game.i18n.format('SFTD.log.warn.CutLooseRollStriderNotInCutLoose', { char: speakerFull.name }));
        else
          speakerFull.sheet.downtimeRollPopup(speakerFull.sheet, ['cutLoose']);
      });
    }
    for (const button of html.querySelectorAll('.reveal-cut-loose-result'))
      button.addEventListener('click', async (_) => BladesHelpers.resolveActor(message.system.cutLooseCrew)?.revealCutLooseResult());
  }
  // Charmwork processing
  for (const button of html.querySelectorAll('.charmwork'))
    button.addEventListener('click', async (ev) => {
      const speakerActorFull = ChatMessage.getSpeakerActor(message.speaker);
      const crewFull = speakerActorFull.type == 'crew' ? speakerActorFull : BladesHelpers.resolveActor(speakerActorFull.system.crew);
      if (!crewFull?.system.harmony.value) {
        ui.notifications.warn(game.i18n.localize('SFTD.log.warn.CharmworkLackingHarmony'));
        return;
      }

      if (message.system.rollData?.rollTypeOrAttributeName == 'SFTD.ResistanceRoll') {
        // Resistance roll
        await cancelRollResult(message.system.rollData, speakerActorFull);
        message.system.rollData.modifiers.push({
          stress: -message.system.rollData.stressChanges[speakerActorFull._id].value,
          harmony: -1,
          rollText: `SFTD.StriderAbility.Charmwork.TimeTravelUsage`,
          key: 'charmwork'
        });
        message.system.rollData.charmwork = true;

        const attributeName = message.system.rollData.attributeName;
        const extraDice = message.system.rollData.additionalDiceFromActionRoll ?? 0;
        const note = message.system.rollData.note;
        const diceAmount = speakerActorFull.getRollData().diceAmount[attributeName] + extraDice;
        const extraFields = { roll_type: 'resistance', modifiers: message.system.rollData.modifiers, actor: speakerActorFull, rollData: message.system.rollData, resistance_attribute: attributeName };
        await bladesRoll(diceAmount, 'SFTD.ResistanceRoll', note, extraFields);
        await BladesHelpers.tryDelete(message);
      } else if (message.system.oldHarmony != undefined) {
        // Start Mission message
        message.system.cutLooseScarMembersWithCharmwork = foundry.utils.flattenObject(message.system.cutLooseScarMembersWithCharmwork);
        const availableActors = Object.fromEntries(Object.entries(message.system.cutLooseScarMembersWithCharmwork).map(m => [BladesHelpers.resolveActor(m[0]), m[1]]).filter(m => m[0] != null && m[0].isOwner).map(m => [m[0].uuid, m[1]]));
        var actorFull = null;
        var stress = 0;
        if (!Object.keys(availableActors).length) {
          ui.notifications.warn(game.i18n.localize('SFTD.log.warn.StartMissionCharmworkNoActor'));
          return;
        } else if (Object.keys(availableActors).length > 1) {
          const speakerFull = ChatMessage.getSpeakerActor(ChatMessage.getSpeaker());
          if (!speakerFull || !Object.keys(availableActors).includes(speakerFull?.uuid)) {
            ui.notifications.warn(game.i18n.localize('SFTD.log.warn.StartMissionCharmworkSeveralActors'));
            return;
          }
          actorFull = speakerFull;
          stress = availableActors[speakerFull.uuid];
        } else {
          [actorFull, stress] = Object.entries(availableActors)[0];
          actorFull = BladesHelpers.resolveActor(actorFull);
        }
        await BladesHelpers.tryUpdate(actorFull, {'system.stress.==value': Math.clamp(actorFull.system.stress.value - stress, 0, actorFull.system.stress.max)});

        const id = Object.keys(message.system.cutLooseScarMembersWithCharmwork).indexOf(actorFull.uuid);
        message.system.cutLooseScarMembersWithCharmwork = Object.fromEntries(Object.entries(message.system.cutLooseScarMembersWithCharmwork).filter((_, i) => i != id));
        const oldHarmony = message.system.oldHarmony - 1;
        await BladesHelpers.tryUpdate(message, {
          '==content': await renderTemplate('systems/songs-for-the-dusk/templates/chat/start-mission.html', { contents: message.system.messageContents, hasAnyCutLooseScarMembersWithCharmwork: Object.keys(message.system.cutLooseScarMembersWithCharmwork).length > 0, oldHarmony: oldHarmony }),
          'system.==cutLooseScarMembersWithCharmwork': message.system.cutLooseScarMembersWithCharmwork,
          'system.==oldHarmony': oldHarmony
        });

        let speaker = {
          actor: actorFull._id,
          alias: actorFull.name,
          scene: null,
          token: actorFull.prototypeToken._id
        };
        const extraFields = {
          title: game.i18n.localize('SFTD.StriderAbility.Charmwork.Title'),
          contents: game.i18n.format('SFTD.StriderAbility.Charmwork.StartMissionTimeTravel', {
            stress: stress,
            strider: actorFull.name
          }),
        }
        let messageData = {
          speaker: speaker,
          content: await renderTemplate('systems/songs-for-the-dusk/templates/chat/generic-message.html', { extraFields: extraFields })
        }
        await ChatMessage.create(messageData);
      } else {
        // Group Action Failure Stress
        speakerActorFull.system.group_action.charmwork = true;
        let leaderFull = BladesHelpers.resolveActor(speakerActorFull.system.group_action.leader);
        await BladesHelpers.tryUpdate(leaderFull, {'system.stress.==value': Math.clamp(leaderFull.system.stress.value - speakerActorFull.system.group_action.stress, leaderFull.system.stress.max, 0)});
        computeGroupActionResultAndSendMessage(speakerActorFull.system.group_action, speakerActorFull, true);
        await BladesHelpers.tryDelete(message);
      }
    });
  for (const element of html.querySelectorAll('.gm-only'))
    if (!game.user.isGM)
      element.style.display = "none";
  for (const element of html.querySelectorAll('.owner-only')) {
    const speakerActorFull = ChatMessage.getSpeakerActor(message.speaker);
    if (!speakerActorFull.isOwner)
      element.style.display = "none";
  }
  for (const element of html.querySelectorAll('.leader-only')) {
    const speakerActorFull = ChatMessage.getSpeakerActor(message.speaker);
    const leaderFull = BladesHelpers.resolveActor(speakerActorFull.system.group_action?.leader)
    if (!leaderFull?.isOwner)
      element.style.display = "none";
  }
  for (const element of html.querySelectorAll('.start-mission-charmwork-only')) {
    const availableActors = foundry.utils.flattenObject(Object.keys(message.system.cutLooseScarMembersWithCharmwork)).map(m => BladesHelpers.resolveActor(m)).filter(m => m != null && m.isOwner);
    if (availableActors.length == 0)
      element.style.display = 'none';
  }
});
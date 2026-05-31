/**
 * A simple and flexible system for world-building using an arbitrary collection of strider and item attributes
 * Author: Atropos
 * Software License: GNU GPLv3
 */

// Import Modules
import { registerSystemSettings } from "./settings.js";
import { preloadHandlebarsTemplates } from "./blades-templates.js";
import { bladesRoll, simpleRollPopup } from "./blades-roll.js";
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
    const option = (key, object) => {
      if (localize) object.label = game.i18n.localize(object.label);
      let isSelected = selected.includes(key);
      html += `<option value="${key}" ${isSelected ? "selected" : ""}>${object.label}</option>`;
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

    let zero_checked = (parseInt(fill) === 0) ? 'checked' : '';
    html += `<input type="radio" value="0" id="clock-0-${uniqueId}}" data-dType="Number" name="${valuePath}" ${zero_checked}>`;

    for (let i = 1; i <= parseInt(size); i++) {
      let checked = (parseInt(fill) === i) ? 'checked' : '';
      html += `
        <input type="radio" value="${i}" id="clock-${i}-${uniqueId}" data-dType="Number" name="${valuePath}" ${checked}>
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

  // Fetch all clock styles
  await BladesHelpers.loadAllClockStyles();

  // Determine whether a system migration is required
  const currentVersion = game.settings.get("songs-for-the-dusk", "systemMigrationVersion");
  const NEEDS_MIGRATION_VERSION = 1.0;
  const needsMigration = currentVersion != NEEDS_MIGRATION_VERSION;

  // Perform the migration
  if (needsMigration && game.user.isGM)
    migrateWorld(currentVersion ?? 0, NEEDS_MIGRATION_VERSION);
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

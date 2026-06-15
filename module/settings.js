import { ClockStylesData } from "./models/clock-styles.js";
import { ClockStylesSettings } from "./settings/clock-styles.js"
import { BladesHelpers } from "./blades-helpers.js";

export const registerSystemSettings = function() {
  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("songs-for-the-dusk", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  game.settings.registerMenu('songs-for-the-dusk', 'ClockStylesMenu', {
    name: game.i18n.localize('SFTD.Settings.ClockStyles.Name'),
    label: game.i18n.localize('SFTD.Settings.ClockStyles.Label'),
    hint: game.i18n.localize('SFTD.Settings.ClockStyles.Hint'),
    icon: "fa-solid fa-chart-pie",
    type: ClockStylesSettings,
    restricted: true
  });

  game.settings.register('songs-for-the-dusk', 'DefaultClockThemeColor', {
    name: game.i18n.localize('SFTD.Settings.DefaultClockThemeColor.Name'),
    hint: game.i18n.localize('SFTD.Settings.DefaultClockThemeColor.Hint'),
    scope: 'world',
    config: true,
    requiresReload: true,
    type: String,
    choices: () => {
      let themes = {};
      for (let [themeName, theme] of Object.entries(BladesHelpers.clockStyles))
        if (themeName != 'dataReason')
          for (let [colorName, color] of Object.entries(theme))
            if (colorName != 'dataReason')
              themes[`${themeName}/${colorName}`] = `${themeName}/${colorName}`;
      return themes;
    },
    default: 'default/black'
  });

  game.settings.register('songs-for-the-dusk', 'ActionRoll', {
    name: game.i18n.localize('SFTD.Settings.Action.Name'),
    hint: game.i18n.localize('SFTD.Settings.Action.Hint'),
    config: true,
    default: true,
    scope: 'world',
    type: new foundry.data.fields.BooleanField(),
    requiresReload: true
  });

  game.settings.register('songs-for-the-dusk', 'ThreatRoll', {
    name: game.i18n.localize('SFTD.Settings.Threat.Name'),
    hint: game.i18n.localize('SFTD.Settings.Threat.Hint'),
    config: true,
    scope: 'world',
    type: new foundry.data.fields.BooleanField(),
    requiresReload: true
  });

  game.settings.register('songs-for-the-dusk', 'PushYourself', {
    name: game.i18n.localize('SFTD.Settings.Push.Name'),
    hint: game.i18n.localize('SFTD.Settings.Push.Hint'),
    config: true,
    scope: 'world',
    type: new foundry.data.fields.BooleanField(),
    requiresReload: true
  });

  game.settings.register('songs-for-the-dusk', 'DeepCutLoad', {
    name: game.i18n.localize('SFTD.Settings.Load.Name'),
    hint: game.i18n.localize('SFTD.Settings.Load.Hint'),
    config: true,
    scope: 'world',
    type: new foundry.data.fields.BooleanField(),
    requiresReload: true
  });

  game.settings.register('songs-for-the-dusk', 'PublicClocks', {
    name: game.i18n.localize('SFTD.Settings.PublicClocks.Name'),
    hint: game.i18n.localize('SFTD.Settings.PublicClocks.Hint'),
    config: true,
    scope: 'world',
    type: new foundry.data.fields.BooleanField(),
    requiresReload: true
  });

  game.settings.register('songs-for-the-dusk', 'ClockStyles', {
    name: game.i18n.localize('SFTD.Settings.ClockStyles.Name'),
    hint: game.i18n.localize('SFTD.Settings.ClockStyles.Hint'),
    config: false,
    default: {},
    scope: 'world',
    type: ClockStylesData,
    requiresReload: true
  });

  game.settings.register('songs-for-the-dusk', 'DowntimeRules', {
    name: game.i18n.localize('SFTD.Settings.DowntimeRules.Name'),
    hint: game.i18n.localize('SFTD.Settings.DowntimeRules.Hint'),
    scope: 'world',
    config: true,
    type: String,
    requiresReload: true,
    default: 'lax',
    choices: {
      strict: game.i18n.localize('SFTD.Settings.DowntimeRules.Strict'),
      lax: game.i18n.localize('SFTD.Settings.DowntimeRules.Lax')
    },
  });
};

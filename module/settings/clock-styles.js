import { ClockStylesData } from "../models/clock-styles.js";
import { BladesHelpers } from "../blades-helpers.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class ClockStylesSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    actions: {
      collapse: ClockStylesSettings.#onCollapse,
    },
    form: {
      handler: ClockStylesSettings.#onSubmit,
      closeOnSubmit: true,
    },
    classes: ["settings", "clock-styles"],
    position: {
      width: 700,
      height: 'auto'
    },
    tag: "form",
    window: {
      icon: "fa-solid fa-bars",
      title: "SFTD.Settings.ClockStyles.Name",
      contentClasses: ["standard-form"]
    }
  }

  static PARTS = {
    main: { template: "systems/songs-for-the-dusk/templates/settings/clock-styles.html" },
    footer: { template: "templates/generic/form-footer.hbs" }
  }

  settings = undefined;

  async _prepareContext(options) {
    if (this.settings === undefined) {
      this.settings = new ClockStylesData({ contents: foundry.utils.deepClone(game.settings.get("songs-for-the-dusk", "ClockStyles").contents) });
    }

    const clockStyles = foundry.utils.deepClone(BladesHelpers.clockStyles);
    for (const [themeName, theme] of Object.entries(clockStyles))
      if (themeName != 'dataReason') {
        for (const [colorName, color] of Object.entries(theme))
          if (colorName != 'dataReason') {
            for (const [sizeName, size] of Object.entries(color))
              if (sizeName != 'dataReason')
                size.shifted = this.settings.contents?.[themeName]?.[colorName]?.[sizeName]?.shifted ?? false;
            color.collapsed = true;
          }
        theme.collapsed = true;
      }

    const context = await super._prepareContext(options);
    return foundry.utils.mergeObject(context, {
      settings: clockStyles,
      systemPath: 'systems/songs-for-the-dusk/themes/',
      worldPath: `worlds/${game.world.id}/themes/`,
      buttons: [
        { type: "save", icon: "fa-solid fa-floppy-disk", label: "SETTINGS.Save" },
        { type: "reload", icon: "fa-solid fa-arrows-rotate", label: "SFTD.Settings.ClockStyles.ReloadClocks" },
        { type: "close", icon: "fa-solid fa-save", label: "SFTD.Settings.ClockStyles.Close" }
      ]
    });
  }

  /**
   * @this ClockStylesSettings
   * @param {PointerEvent} event   The originating click event.
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action].
   */
  static async #onCollapse(event, target) {
    const dataContainer = target.closest('.row-container').querySelector('.data-container');
    if (dataContainer.classList.contains('collapsed'))
      dataContainer.classList.remove('collapsed');
    else
      dataContainer.classList.add('collapsed');
  }

  static async #onSubmit(event, form, formData) {
    if (event.submitter.attributes.type.value == 'reload') {
      await BladesHelpers.loadAllClockStyles();
      await foundry.applications.settings.SettingsConfig.reloadConfirm({world: true});
    } else if (event.submitter.attributes.type.value == 'save') {
      const settings = foundry.utils.expandObject(formData.object);
      let output = new ClockStylesData(settings);

      game.settings.set("songs-for-the-dusk", "ClockStyles", output);
      let themeColor = game.settings.get("songs-for-the-dusk", "DefaultClockThemeColor").split('/');
      if (!output.contents?.[themeColor[0]]?.[themeColor[1]]) {
        let themeEntry = Object.entries(output.contents).filter(t => t[0] != 'dataReason' && Object.entries(t[1]).filter(c => c[0] != 'dataReason' && Object.entries(c[1]).filter(s => s[0] != 'dataReason').length > 0).length > 0)[0];
        let colorEntry = Object.entries(themeEntry[1]).filter(c => c[0] != 'dataReason' && Object.entries(c[1]).filter(s => s[0] != 'dataReason').length > 0)[0];
        game.settings.set("songs-for-the-dusk", "DefaultClockThemeColor", `${themeEntry[0]}/${colorEntry[0]}`);
      }

      this.settings = undefined;
      await foundry.applications.settings.SettingsConfig.reloadConfirm({world: true});
    }
    await this.close();
  }

  _onClose(options) {
    this.settings = undefined;
  }
}

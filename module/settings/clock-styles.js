import { ClockStylesData } from "../models/clock-styles.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class ClockStylesSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    actions: {
      addStyle: ClockStylesSettings.#onAddStyle,
      removeStyle: ClockStylesSettings.#onRemoveStyle,
      reset: ClockStylesSettings.#onReset
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
  defaultStyleIndex = undefined;
  hasDefaultStyleIndexChanged = false;

  async _prepareContext(options) {
    if (this.settings === undefined) {
      this.settings = new ClockStylesData({ contents: foundry.utils.deepClone(game.settings.get("songs-for-the-dusk", "ClockStyles").contents) });
      this.defaultStyleIndex = Number(game.settings.get("songs-for-the-dusk", "DefaultClockStyle"));
    }

    const context = await super._prepareContext(options);
    return foundry.utils.mergeObject(context, {
      settings: this.settings,
      buttons: [
        { type: "reset", icon: "fa-solid fa-arrows-rotate", label: "SETTINGS.Reset", action: "reset" },
        { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" }
      ]
    });
  }

  /**
   * @this ClockStylesSettings
   * @param {PointerEvent} event   The originating click event.
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action].
   */
  static async #onAddStyle(event, target) {
    let newLine = { name: "style", inWorldFolder: true, isColored: false, imageType: "svg" };
    this.settings.contents.push(newLine);
    await this.render(true);
  }

  /**
   * @this ClockStylesSettings
   * @param {PointerEvent} event   The originating click event.
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action].
   */
  static async #onRemoveStyle(event, target) {
    let id = $(target).closest(".clock-style").index();
    if (id == this.defaultStyleIndex)
      this.defaultStyleIndex = -1;
    else if (id < this.defaultStyleIndex)
      this.defaultStyleIndex --;
    this.settings.contents.splice(id, 1);
    await this.render(true);
  }

  /**
   * @this ClockStylesSettings
   * @param {PointerEvent} event   The originating click event.
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action].
   */
  static async #onReset(event, target) {
    game.settings.set("songs-for-the-dusk", "ClockStyles", {
      contents: [
        { name: "default", inWorldFolder: false, isColored: true, imageType: "svg" }
      ]
    })
    this.settings = undefined;
    await foundry.applications.settings.SettingsConfig.reloadConfirm({world: true});
    await this.close();
  }

  static async #onSubmit(event, form, formData) {
    const settings = foundry.utils.expandObject(formData.object);
    let output = new ClockStylesData({contents: []});
    for (let style of Object.values(settings.contents)) {
      output.contents.push({
        name: style.name,
        inWorldFolder: style.inWorldFolder,
        isColored: style.isColored,
        imageType: style.imageType
      });
    }

    game.settings.set("songs-for-the-dusk", "ClockStyles", { contents: output.contents });
    if (this.defaultStyleIndex == -1)
      game.settings.set("songs-for-the-dusk", "DefaultClockStyle", 0);
    else
      game.settings.set("songs-for-the-dusk", "DefaultClockStyle", this.defaultStyleIndex);
    this.settings = undefined;
    await foundry.applications.settings.SettingsConfig.reloadConfirm({world: true});
    await this.close();
  }

  _onClose(options) {
    this.settings = undefined;
  }
}

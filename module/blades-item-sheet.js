/**
 * Extend the basic ItemSheet
 * @extends {ItemSheet}
 */
import {onManageActiveEffect, prepareActiveEffectCategories} from "./effects.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { getItemSheetClass, enrichHTML } from "./compat.js";
import { BladesHelpers } from "./blades-helpers.js";

const BaseItemSheet = getItemSheetClass();

export class BladesItemSheet extends BaseItemSheet {

  /** @override */
	static get defaultOptions() {

	  return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["songs-for-the-dusk", "sheet", "item"],
			width: 560,
			height: 'auto',
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}]
		});
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = "systems/songs-for-the-dusk/templates/items";
    let simple_item_types = ["crew_reputation"];
    let template_name = `${this.item.type}`;

    if (simple_item_types.indexOf(this.item.type) >= 0) {
      template_name = "simple";
    }

    return `${path}/${template_name}.html`;
  }

  /* -------------------------------------------- */

  /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    //for compatibility with bitd-alternate-sheets v1.0.10
    let alt_sheets = false;
    try {alt_sheets = game.modules.get("bitd-alternate-sheets").active;} catch {}
    if (alt_sheets) {
      html.find("input.radio-toggle, label.radio-toggle").click((e) => e.preventDefault());
      html.find("input.radio-toggle, label.radio-toggle").mousedown((e) => {
        BladesHelpers.onRadioToggle(e);
      });
      html.find("input.radio-toggle, label.radio-toggle").contextmenu((e) => {
        BladesHelpers.onRadioToggle(e);
      });
    } else {
      html.find("input.radio-toggle, label.radio-toggle").click((e) => {
        BladesHelpers.onRadioToggle(e);
      });
      html.find("input.radio-toggle, label.radio-toggle").contextmenu((e) => {
        BladesHelpers.onRadioToggle(e);
      });
    }

    html.find(".effect-control").click(ev => {
      if ( this.item.isOwned ) return ui.notifications.warn(game.i18n.localize("SFTD.EffectWarning"))
      BladesActiveEffect.onManageActiveEffect(ev, this.item)
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const superData = super.getData( options );
    const sheetData = superData.data;

    sheetData.isGM = game.user.isGM;
    sheetData.owner = superData.owner;
    sheetData.editable = superData.editable;

    // Prepare Active Effects
    sheetData.effects = prepareActiveEffectCategories(this.document.effects);

    sheetData.system.description = await enrichHTML(sheetData.system.description, {secrets: sheetData.owner, async: true});

    return sheetData;
  }
}

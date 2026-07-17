/**
 * Extend the basic ItemSheet
 * @extends {ItemSheet}
 */
import {onManageActiveEffect, prepareActiveEffectCategories} from './effects.js';
import { BladesActiveEffect } from './blades-active-effect.js';
import { getItemSheetClass, enrichHTML } from './compat.js';
import { BladesHelpers } from './blades-helpers.js';

const BaseItemSheet = getItemSheetClass();

export class BladesItemSheet extends BaseItemSheet {

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ['songs-for-the-dusk', 'sheet', 'item'],
			width: 560,
			height: 'auto',
      tabs: [{navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'description'}]
		});
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = 'systems/songs-for-the-dusk/templates/items';
    let simple_item_types = [];
    let template_name = `${this.item.type}`;

    if (simple_item_types.indexOf(this.item.type) >= 0)
      template_name = 'simple';

    return `${path}/${template_name}.html`;
  }

  /* -------------------------------------------- */

  /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html.find('.effect-control').click(ev => {
      if (this.item.isOwned) return ui.notifications.warn(game.i18n.localize('SFTD.EffectWarning'));
      ev.preventDefault();
      BladesActiveEffect.onManageActiveEffect(ev, this.item);
    });

    html.find('label.radio-toggle').click((e) => {
      BladesHelpers.onRadioToggle(e);
      e.preventDefault();
    });
    html.find('label.radio-toggle').contextmenu((e) => {
      BladesHelpers.onRadioToggle(e);
      e.preventDefault();
    });

    html.find('.add-quality').click(async (e) => {
      await this.object.update({'system.quality_modifier': this.object.system.quality_modifier + 1});
      await this.object.updateSpecialistQuality();
    });
    html.find('.remove-quality').click(async (e) => {
      await this.object.update({'system.quality_modifier': this.object.system.quality_modifier - 1});
      await this.object.updateSpecialistQuality();
    });

    html.find('.edge > input').click(async (e) => {
      const element = e.currentTarget;
      const edge = element.dataset.edgeflaw;
      const edges = this.object.system.edges;
      if (edges.includes(edge))
        edges.splice(edges.indexOf(edge), 1);
      else
        edges.push(edge);
      await this.object.update({system: {'==edges': edges}});
    });
    html.find('.flaw > input').click(async (e) => {
      const element = e.currentTarget;
      const flaw = element.dataset.edgeflaw;
      const flaws = this.object.system.flaws;
      if (flaws.includes(flaw))
        flaws.splice(flaws.indexOf(flaw), 1);
      else
        flaws.push(flaw);
      await this.object.update({system: {'==flaws': flaws}});
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const superData = super.getData(options);
    const sheetData = superData.data;

    sheetData.isGM = game.user.isGM;
    sheetData.owner = superData.owner;
    sheetData.editable = superData.editable;

    // Prepare Active Effects
    sheetData.effects = prepareActiveEffectCategories(this.document.effects);

    sheetData.system.description = await enrichHTML(sheetData.system.description, {secrets: sheetData.owner, async: true});

    if (sheetData.type == 'specialist') {
      sheetData.system.edge_list = ['Independent', 'Unrelenting', 'Loyal', 'Sociable'];
      sheetData.system.flaw_list = ['Unreliable', 'Ill-liked', 'Principled', 'Reckless'];
      sheetData.system.vehicle_edge_list = ['Nimble', 'Auto-Repair', 'Rugged'];
      sheetData.system.vehicle_flaw_list = ['Guzzler', 'Finicky', 'Flashy'];
    } else if (sheetData.type == 'foundation' && superData.item.actor)
      sheetData.npcs = Object.values(superData.item.actor.system?.members).map(m => BladesHelpers.resolveActor(m)).filter(m => m != null && m.type == 'npc');

    return sheetData;
  }
}

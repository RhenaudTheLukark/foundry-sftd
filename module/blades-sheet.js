import { BladesActiveEffect } from './blades-active-effect.js';
import { BladesHelpers } from './blades-helpers.js';
import { getActorSheetClass } from './compat.js';

const BaseActorSheet = getActorSheetClass();

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */

export class BladesSheet extends BaseActorSheet {

  /* -------------------------------------------- */

  /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html.find('.item-add-popup').click(this.onItemAddClick.bind(this));
    html.find('.actor-add-popup').click(this.onActorAddClick.bind(this));
    html.find('.update-box').click(this.onUpdateBoxClick.bind(this));

    html.find('label.radio-toggle').click((e) => {
      BladesHelpers.onRadioToggle(e);
      e.preventDefault();
    });
    html.find('label.radio-toggle').contextmenu((e) => {
      BladesHelpers.onRadioToggle(e);
      e.preventDefault();
    });

    // Post item to chat
    html.find('.item-post').click((ev) => {
      const element = $(ev.currentTarget).closest('.item');
      const item = this.actor.items.get(element.data('itemId'));
      item.sendToChat();
    });

    html.find('.roll-die-attribute').click(this.onRollAttributeDieClick.bind(this));

    // Update Inventory Item
    html.find('.item-body').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let item = this.actor.items.get(element.data('itemId'));
      item?.sheet.render(true);
    });

    // Open Actor
    html.find('.open-actor').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      //acqId is the UUID of the Actor
      let acqId = element.data('itemId');
      // if the Actor is not in the world the if loop will trigger
      let actor = BladesHelpers.resolveActor(acqId);
      actor?.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.delete-item').click(async ev => {
      let element = $(ev.currentTarget).closest('.item');
      let item = this.actor.items.get(element.data('itemId'));
      if (element.parent().hasClass('item-with-container'))
        element = element.parent();
      element.slideUp(200, async () => await this.actor.removeItem(item));
    });

    // Update Relationship Status
    html.find('.status-block label.input').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let entityFull = BladesHelpers.resolveActor(element.data('itemId'));
      if (entityFull)
        await BladesHelpers.handleRelationshipValue(this.actor, entityFull, 'status', $(ev.currentTarget).data('value'), true);
    });

    // Delete Relationship
    html.find('.delete-relationship:not(.disabled-item)').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let entityFull = BladesHelpers.resolveActor(element.data('itemId'));
      if (entityFull)
        BladesHelpers.removeRelationship(this.actor, entityFull);
    });

    html.find('.death-toggle').click(async ev => {
      const targetId = $(ev.currentTarget).data('targetId') ?? this.actor.uuid;
      const targetFull = BladesHelpers.resolveActor(targetId);
      await BladesHelpers.tryUpdate(targetFull, {system: {'==dead': !targetFull.system.dead}});
      const pilotFull = BladesHelpers.resolveActor(targetFull.system.pilot);
      if (pilotFull)
        await BladesHelpers.tryUpdate(pilotFull, {'==name': pilotFull.name});
    });

    // Manage active effects
    html.find('.effect-control').click(ev => BladesActiveEffect.onManageActiveEffect(ev, this.actor));

    html.find('.clock-style-picker').click(async ev => {
      let element = ev.currentTarget;
      let path = element.dataset.path;
      let themeColor = element.dataset.themeColor;
      await this.clockStylePickerPopup(path, themeColor);
    });
  }

  /* -------------------------------------------- */

  async onItemAddClick(event) {
    event.preventDefault();
    const itemTypes = $(event.currentTarget).data('itemType').split(',');
    const valuePath = $(event.currentTarget).data('valuePath');
    const unique = $(event.currentTarget).data('unique');
    const addAsItem = $(event.currentTarget).data('addAsItem') ?? true;
    const containerId = $(event.currentTarget).data('containerId');
    let inputType = 'checkbox';

    let itemElement = $(event.currentTarget).closest('.item-with-container').children('.item');
    if (itemElement.length) {
      let [_, item] = this.actor.getItemOwner(itemElement[0].data('itemId'));
      if (item.system.suppressed) {
        ui.notifications.warn(game.i18n.localize('SFTD.log.warn.NoAddFromSuppressedContainer'));
        return;
      }
    }

    if (unique !== undefined)
      inputType = 'radio';

    let items = await BladesHelpers.getAllObjectDocumentsByType(itemTypes, [], game);
    let title = '';
    for (let itemType of itemTypes)
      title += (title.length ? ' / ' : '') + game.i18n.localize(`TYPES.Item.${itemType}`);
    if (items.length == 0) {
      ui.notifications.warn(game.i18n.localize('SFTD.log.warn.NothingToAdd'));
      return;
    }
    let dialogId = foundry.applications.api.ApplicationV2._appId + 1;
    let html = `<input id="${dialogId}-search-bar" type="text" value="" placeholder="${game.i18n.format('SFTD.SearchBar', { obj: title })}" autofocus>`;
    html += `<div class="objects-to-add">`;
    items.forEach(e => {
      let additionPriceLoad = ``;
      if (typeof e.system.load !== 'undefined') additionPriceLoad += `(${e.system.load})`
      else if (typeof e.system.price !== 'undefined') additionPriceLoad += `(${e.system.price})`

      html += `<input id="${dialogId}-select-item-${e._id}" name="select_items" type="${inputType}" value="${e._id}">`;
      html += `<label class="entry" for="${dialogId}-select-item-${e._id}">`;
      html += `${game.i18n.localize(e.name)} ${additionPriceLoad} <i class="fas fa-question-circle" data-tooltip="${game.i18n.localize(e.system.description)}"></i>`;
      html += `</label>`;
    });

    html += `</div>`;

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('SFTD.Add')} ${title}` },
      content: html,
      buttons: [
        {
          icon: 'fas fa-check',
          label: game.i18n.localize('SFTD.Add'),
          action: 'add',
          default: true
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('SFTD.Cancel'),
          action: 'cancel'
        }
      ],
      submit: async (result, dialog) => {
        if (result == 'add')
          for (let itemType of itemTypes)
            await this.addItemsToSheet(itemType, $(dialog.element).find('.objects-to-add'), valuePath, addAsItem, containerId);
      }
    });

    dialog._onFirstRender = this.dialogOnFirstRender;
    dialog.render(true);
  }

  async onActorAddClick(event) {
    event.preventDefault();
    let actorTypes = $(event.currentTarget).data('actorType');
    let valuePaths = $(event.currentTarget).data('valuePath');
    const parentPath = $(event.currentTarget).data('parentPath');
    const unique = $(event.currentTarget).data('unique');
    let title = $(event.currentTarget).data('title');

    let inputType = 'checkbox';
    if (unique !== undefined)
      inputType = 'radio';

    if (actorTypes) actorTypes = actorTypes.split(',');
    if (valuePaths) valuePaths = valuePaths.split(',');

    let exclusionList = [];
    if (unique === undefined && valuePaths)
      for (let valuePath of valuePaths) {
        exclusionList = BladesHelpers.getNestedProperty(this.actor, valuePath);
        exclusionList = Object.values(exclusionList).map(e => e.uuid);
      }

    if (!title)
      title = game.i18n.localize(`TYPES.Actor.${actorTypes}`);

    let dialogId = foundry.applications.api.ApplicationV2._appId + 1;
    let actors = [];
    if (actorTypes && actorTypes[0] == 'crewmate') {
      actorTypes = ['strider', 'npc'];
      let crewFull;
      if (this.actor.system.crew)
        crewFull = BladesHelpers.resolveActor(this.actor.system.crew);
      if (!crewFull) {
        ui.notifications.warn(game.i18n.localize('SFTD.log.warn.NoCrewToAddConnection'));
        return;
      }
      actors = BladesHelpers.fetchSimpleData(Object.values(crewFull.system.members).filter(m => m.uuid != this.actor.uuid && !Object.values(this.actor.system.connections).map(c => c.uuid).includes(m.uuid)), [], BladesHelpers._simpleCompareFunc);
    } else
      for (let actorType of actorTypes)
        actors = actors.concat(await BladesHelpers.getAllObjectDocumentsByType(actorType, exclusionList, game));
    if (actors.length == 0) {
      ui.notifications.warn(game.i18n.localize('SFTD.log.warn.NothingToAdd'));
      return;
    }
    let html = `<input id="${dialogId}-search-bar" type="text" value="" placeholder="${game.i18n.format('SFTD.SearchBar', {obj: title})}" autofocus>`
    html += `<div class="objects-to-add">`;

    for (let actor of actors) {
      html += `<input id="${dialogId}-select-actor-${actor._id}" name="select_actors" type="${inputType}" value="${actor._id}">`;
      html += `<label class="entry" for="${dialogId}-select-actor-${actor._id}">`;
      // Try to fetch known parent if it exists
      let parentName = ``;
      let parentValue = undefined;
      if (parentPath) {
        parentValue = BladesHelpers.getNestedProperty(actor, parentPath);
        if (parentValue) parentValue = BladesHelpers.resolveActor(parentValue);
        if (parentValue) parentName = `(${game.i18n.localize(parentValue.name)})`;
      }
      html += `${game.i18n.localize(actor.name)} ${parentName}`;
      html += `</label>`;
    }

    html += `</div>`;

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('SFTD.Add')} ${title}` },
      content: html,
      buttons: [
        {
          icon: 'fas fa-check',
          label: game.i18n.localize('SFTD.Add'),
          action: 'add',
          default: true
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('SFTD.Cancel'),
          action: 'cancel'
        }
      ],
      submit: async (result, dialog) => {
        if (result == 'add')
          await this.addActorsToSheet(actorTypes, $(dialog.element).find('.objects-to-add'));
      }
    });

    dialog._onFirstRender = this.dialogOnFirstRender;
    dialog.render(true);
  }

  dialogOnFirstRender(context, options) {
    let searchBar = this.element.querySelector('input[type=text]');
    searchBar.addEventListener('input', (event) => {
      for (let label of this.element.querySelector('.objects-to-add').querySelectorAll('.entry')) {
        let visible = label.innerText.toLowerCase().includes(event.target.value.toLowerCase());
        let alreadyHidden = label.classList.contains('hidden');
        if (alreadyHidden && visible)
          label.classList.remove('hidden');
        else if (!alreadyHidden && !visible)
          label.classList.add('hidden');
      }
    });

    let scroll = this.element.querySelector('.window-content');
    scroll.scrollTop = 0;
  }

  /* -------------------------------------------- */

  async addItemsToSheet(itemType, el, valuePath, addAsItem, containerId) {
    let items = await BladesHelpers.getAllObjectDocumentsByType(itemType, [], game);
    let itemsToAdd = [];
    el.find('input:checked').each(function() {
      let item = items.find(e => e._id === $(this).val());
      if (item)
        itemsToAdd.push(item);
    });

    if (!valuePath) {
      let items = await BladesHelpers.tryCreate(itemsToAdd, this.actor);
      for (let item of items) {
        if (containerId)
          await BladesHelpers.tryUpdate(item, {system: {'==owner': containerId}});
        if (item?.system?.uses?.value != undefined)
          await BladesHelpers.tryUpdate(item, {system: {uses: {'==value': item.system.uses.max}}});
      }
    } else if (addAsItem)
      this.addItemAsObjectAndStoreReference(itemsToAdd[0], valuePath);
    else
      this.addItemAsReference(itemsToAdd[0], valuePath);
    await this.handleAddedObjects(itemsToAdd);
  }

  async addItemAsObjectAndStoreReference(itemToAdd, valuePath) {
    let itemFull = await BladesHelpers.tryCreate([itemToAdd], this.document)[0];
    if (!itemFull)
      return;
    if (itemFull.system.uses)
      await BladesHelpers.tryUpdate(itemFull, {system: {uses: {'==value': itemFull.system.uses.max}}});
    let updateObject = BladesHelpers.createUpdateObjectFromPath(itemFull._id, valuePath);
    // Fetch object and delete it if it exists
    let objectToDelete = this.actor;
    for (let pathPart of valuePath.split('.')) {
      if (!objectToDelete)
        break;
      objectToDelete = objectToDelete[pathPart];
    }
    if (typeof objectToDelete != 'undefined' && this.actor.items.find(i => i._id == objectToDelete))
      await this.actor.removeItem(await BladesHelpers.getOwnedItem(this.actor, objectToDelete));
    await BladesHelpers.tryUpdate(this.actor, updateObject);
  }

  async addItemAsReference(itemToAdd, valuePath) {
    if (!itemToAdd)
      return;
    itemToAdd = { name: itemToAdd.name, id: itemToAdd.id, img: itemToAdd.img, system: foundry.utils.deepClone(itemToAdd.system) };
    let updateObject = BladesHelpers.createUpdateObjectFromPath(itemToAdd, valuePath);
    await BladesHelpers.tryUpdate(this.actor, updateObject);
  }

  async addActorsToSheet(actorTypes, el) {
    let actors = await BladesHelpers.getAllObjectDocumentsByType(actorTypes, [], game);
    let actorsToAdd = [];
    el.find('input:checked').each(function() {
      actorsToAdd.push(actors.find(e => e._id === $(this).val()));
    });

    await this.actor.sheet.handleAddedObjects(actorsToAdd);
  }

  /* -------------------------------------------- */

  /**
   * Roll an Attribute die.
   * @param {*} event
   */
  async onRollAttributeDieClick(event) {
    const attributeName = $(event.currentTarget).data('rollAttribute');
    await this.actor.rollAttributePopup(attributeName);
  }

  /* -------------------------------------------- */

  async onUpdateBoxClick(event) {
    event.preventDefault();
    const itemId = $(event.currentTarget).data('item');
    var updateValue = $(event.currentTarget).data('value');
    const updateType = $(event.currentTarget).data('utype');
    if (updateValue === undefined)
      updateValue = document.getElementById('fac-' + updateType + '-' + itemId).value;
    var update;
    if (updateType === 'status')
      update = {_id: itemId, system: {status: {value: updateValue}}};
    else if (updateType == 'hold')
      update = {_id: itemId, system: {hold: {value: updateValue}}};
    else {
      console.log('update attempted for type undefined in blades-sheet.js onUpdateBoxClick function');
      return;
    };

    await this.actor.updateEmbeddedDocuments('Item', [update]);
  }

  /* -------------------------------------------- */

  /**
   * Call a popup for changing a clock's theme and color.
   */
  async clockStylePickerPopup(path, themeColor) {
    let defaultThemeColor = game.settings.get('songs-for-the-dusk', 'DefaultClockThemeColor');

    let clockStylesDropdown = { 'null': `${defaultThemeColor} (default)` };
    for (let [themeName, theme] of Object.entries(BladesHelpers.clockStyles))
      if (themeName != 'dataReason')
        for (let [colorName, color] of Object.entries(theme))
          if (colorName != 'dataReason')
            clockStylesDropdown[`${themeName}/${colorName}`] = `${themeName}/${colorName}`;

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('SFTD.ClockStylePicker')}` },
      content: await foundry.applications.handlebars.renderTemplate('systems/songs-for-the-dusk/templates/popups/clock-style-picker.html', { clockStylesDropdown: clockStylesDropdown, themeColor: themeColor }),
      classes: ['clock-style-picker'],
      buttons: [
        {
          icon: 'fas fa-save',
          label: game.i18n.localize('SETTINGS.Save'),
          action: 'save',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('SFTD.Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'save') return;

        let value = dialog.element.querySelector('select').value;
        let updateObject = {};
        updateObject[path] = value;
        await BladesHelpers.tryUpdate(this.actor, updateObject);
      }
    });
    await dialog.render(true);
  }
}

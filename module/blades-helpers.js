import { SFTDChatMessage } from "./messages/sftd-chat-message.js";
import { generateRandomId } from "./compat.js";
import { openFormDialog } from "./lib/dialog-compat.js";

export class BladesHelpers {

  static createUpdateObjectFromPath(value, path) {
    let reversePath = path.split('.').reverse();
    let updateObject = {};
    updateObject[`==${reversePath[0]}`] = value;
    reversePath.splice(0, 1);
    while (reversePath.length > 0) {
      let newUpdateObject = {};
      newUpdateObject[reversePath[0]] = updateObject;
      updateObject = newUpdateObject;
      reversePath.splice(0, 1);
    }
    return updateObject;
  }

  static mergeAddObjects(obj1, ignoredFields, ...objs) {
    let output = Object.assign({}, obj1);
    for (let obj of objs) {
      for (let [k, v] of Object.entries(obj)) {
        if (ignoredFields.includes(k))
          { /* Nothing */ }
        else if (output[k] !== undefined)
          output[k] += v;
        else
          output[k] = v;
      }
    }
    return output;
  }

  static getClockSpritePath(clockStyle) {
    let path = 'systems/songs-for-the-dusk/themes/';
    if (clockStyle.inWorldFolder)
      path = `worlds/${game.world.id}/themes/`;
    return path + `${clockStyle.theme}/${clockStyle.color}/`;
  }

  /**
   * Identifies duplicate items by type and returns a array of item ids to remove
   *
   * @param {Object} item_data
   * @param {Document} actor
   * @returns {Array}
   *
   */
  static removeDuplicatedItemType(item_data, actor) {
    let dupe_list = [];
    let distinct_types = ["crew_type", "crew_reputation", "class"];
    let allowed_types = ["item"];
    let should_be_distinct = distinct_types.includes(item_data.type);
    // If the Item has the exact same name - remove it from list.
    // Remove Duplicate items from the array.
    actor.items.forEach(i => {
      let has_double = (item_data.type === i.type);
      if (((i.name === item_data.name) || (should_be_distinct && has_double)) && !(allowed_types.includes(item_data.type)) && (item_data._id !== i.id)) {
        dupe_list.push(i.id);
      }
    });

    return dupe_list;
  }

  /**
   * Get a nested dynamic attribute.
   * @param {Object} obj
   * @param {string} property
   */
  static getNestedProperty(obj, property) {
    return property.split('.').reduce((r, e) => {
      return r[e];
    }, obj);
  }

  /**
   * Get the list of all available ingame objects by type.
   *
   * @param {string | List<string>} objectTypes
   * @param {Object} game
   */
  static getAllObjectsByType(objectTypes, exclusionList, game) {
    if (!Array.isArray(objectTypes))
      objectTypes = [objectTypes];

    let output = [];
    for (let objectType of objectTypes) {
      let isActor = ['faction', 'crew', 'strider', 'npc'].includes(objectType);
      let container = isActor ? game.actors : game.items;
      let worldObjects = container.filter(e => e.type === objectType && !exclusionList.includes(e.uuid)).map(e => { return e });

      let objectList = worldObjects;
      if (!isActor) {
        let pack = game.packs.find(e => e.metadata.name === objectType);
        let compendiumItems = [];
        for (let object of pack)
          compendiumItems.push(object);
        objectList = objectList.concat(compendiumItems);
      }
      output = output.concat(objectList.sort((a, b) => a.name.toUpperCase().localeCompare(b.name.toUpperCase())));
    }
    return output;
  }

  /**
   * Get the list of all available ingame object documents by type.
   *
   * @param {string | List<string>} objectTypes
   * @param {Object} game
   */
  static async getAllObjectDocumentsByType(objectTypes, exclusionList, game) {
    if (!Array.isArray(objectTypes))
      objectTypes = [objectTypes];

    let output = [];
    for (let objectType of objectTypes) {
      let isActor = ['faction', 'crew', 'strider', 'npc'].includes(objectType);
      let container = isActor ? game.actors : game.items;
      let worldObjects = container.filter(e => e.type === objectType && !exclusionList.includes(e.uuid)).map(e => { return e });

      let objectList = worldObjects;
      if (!isActor) {
        let pack = game.packs.find(e => e.metadata.name === objectType);
        let compendiumContent = await pack.getDocuments();
        let compendiumItems = compendiumContent.map(e => { return e });
        objectList = objectList.concat(compendiumItems);
      }
      output = output.concat(objectList.sort((a, b) => a.name.toUpperCase().localeCompare(b.name.toUpperCase())));
    }
    return output;
  }

  static prepareItemDropdown(itemType, allowEmpty, game) {
    let items = BladesHelpers.getAllObjectsByType(itemType, [], game);

    let result = {};
    if (allowEmpty)
      result[''] = game.i18n.localize('SFTD.None');
    items.forEach(item => { result[item._id] = item.name; });

    return result;
  }

  static getOwnedItem(obj, itemId, defaultValue = null) {
    if (itemId) {
      const itemCollectionId = obj.items.contents.findIndex(i => i._id == itemId);
      if (itemCollectionId >= 0)
        return obj.items.contents[itemCollectionId];
    }
    return defaultValue;
  }

  static resolveOwnedItem(itemId, itemType, defaultValue, game) {
    if (!itemId)
      return defaultValue;

    // Check World Objects
    let worldResult = BladesHelpers.resolveWorldItem(itemId, game);
    if (worldResult)
      return worldResult;

    // Check Compendium Objects
    if (itemType) {
      let compendiumResult = BladesHelpers.resolveCompendiumItem(itemId, itemType, game);
      if (compendiumResult)
        return compendiumResult;
    }

    console.warn(`Could not resolve actor or item with ID ${itemId}.`)
    return {}
  }

  static resolveWorldItem(itemId, game) {
    // Check Actor
    let actor = game.actors.filter(e => e._id === itemId);
    if (actor.length > 0)
      return actor[0];

    // Check World Items
    let item = game.items.filter(e => e._id === itemId);
    if (item.length > 0)
      return item[0];
  }

  static resolveCompendiumItem(itemId, itemType, game) {
    let pack = game.packs.find(e => e.metadata.name === itemType);
    return pack?.contents.find(e => e._id == itemId);
  }

  /**
   *
   * @param {Actor} objectFull
   * @param {object} updateObject
   */
  static async tryCreate(objectsData, parentFull) {
    if (!objectFull)
      return;
    if (objectFull.canUserModify(game.user, 'create')) {
      if (parentFull)
        await Item.create(objectsData, {parent: parentFull});
    } else {
      // Send a specific message to the GM to update some data on their end
      let speaker = ChatMessage.getSpeaker();
      let messageData = {
        speaker: speaker,
        messageType: 'createRequest',
        objectData: objectsData,
        parentUuid: parentFull ? parentFull.uuid : null,
        objectEmbeddedName: parentFull ? 'Item' : '',
        content: '',
        blind: true,
        whisper: game.users.activeGM ? [game.users.activeGM.id] : game.users.filter(u => u.isGM).map(u => u.id)
      }
      let message = await SFTDChatMessage.create(messageData);

      if (game.users.activeGM)
        // Wait for the message to be handled to continue;
        await BladesHelpers.until(_ => message.system.handled == true);
      else
        // Notify the player that the data will be handled when a GM connects
        ui.notifications.warn(game.i18n.localize('SFTD.log.warn.TryUpdateNoActiveGM'));
    }
  }

  /**
   *
   * @param {Actor} objectFull
   * @param {object} updateObject
   */
  static async tryUpdate(objectFull, updateObject) {
    if (!objectFull)
      return;
    if (objectFull.canUserModify(game.user, 'update'))
      await objectFull.update(updateObject);
    else {
      // Send a specific message to the GM to update some data on their end
      let speaker = ChatMessage.getSpeaker();
      let messageData = {
        speaker: speaker,
        messageType: 'updateRequest',
        updateQuery: JSON.stringify(updateObject),
        objectUuid: objectFull.uuid,
        content: '',
        blind: true,
        whisper: game.users.activeGM ? [game.users.activeGM.id] : game.users.filter(u => u.isGM).map(u => u.id)
      }
      let message = await SFTDChatMessage.create(messageData);

      if (game.users.activeGM)
        // Wait for the message to be handled to continue;
        await BladesHelpers.until(_ => message.system.handled == true);
      else
        // Notify the player that the data will be handled when a GM connects
        ui.notifications.warn(game.i18n.localize('SFTD.log.warn.TryUpdateNoActiveGM'));
    }
  }

  /**
   *
   * @param {Actor} objectFull
   * @param {object} updateObject
   */
  static async tryDelete(objectFull, parentFull) {
    if (!objectFull)
      return;
    if (objectFull.canUserModify(game.user, 'delete'))
      await objectFull.delete();
    else {
      // Send a specific message to the GM to delete the object
      let speaker = ChatMessage.getSpeaker();
      let messageData = {
        speaker: speaker,
        messageType: 'deleteRequest',
        objectUuid: objectFull.uuid,
        parentUuid: parentFull ? parentFull.uuid : null,
        objectEmbeddedName: parentFull ? objectFull.split('.')[0] : null,
        content: '',
        blind: true,
        whisper: game.users.activeGM ? [game.users.activeGM.id] : game.users.filter(u => u.isGM).map(u => u.id)
      }
      let message = await SFTDChatMessage.create(messageData);

      if (game.users.activeGM)
        // Wait for the message to be handled to continue;
        await BladesHelpers.until(_ => message.system.handled == true);
      else
        // Notify the player that the data will be handled when a GM connects
        ui.notifications.warn(game.i18n.localize('SFTD.log.warn.TryDeleteNoActiveGM'));
    }
  }

  static async until(conditionFunction) {
    const poll = resolve => {
      if (conditionFunction())
        resolve();
      else
        setTimeout(_ => poll(resolve), 10);
    }

    return new Promise(poll);
  }

  static async onRadioToggle(event) {
    let type = event.target.tagName.toLowerCase();
    let element = event.target;
    let target = type == 'label' ? element : element.parentElement;
    let label = target;
    type = target.tagName.toLowerCase();
    if (type == 'label')
      target = label.previousElementSibling;

    // Get the last enabled element
    let enabledLabels = Object.values(target.parentElement.children).filter(e => e.classList.contains('enabled'));
    if (enabledLabels[enabledLabels.length-1] == label || target.checked || (event.type == 'contextmenu')) {
      // Find the next lowest-value input with the same name
      let name = target.name;
      if (!name) name = target.dataset.name;
      let value = target.value;
      if (!value) value = target.dataset.value;
      value = parseInt(value);
      value = value + (value < 0 ? 1 : -1);
      let prevEl = target.parentElement.querySelector(`[name='${name}'][value='${value}'], [name="${name}"][value="${value}"]`);
      $(prevEl).trigger('click');
    } else {
      //trigger the click on this one
      $(target).trigger('click');
    }
  }

  /**
   * Add item functionality
   */
  static async _addOwnedItem(event, actor) {
    event.preventDefault();
    const a = event.currentTarget;
    const itemType = a.dataset.itemType;

    let data = {
      name: randomID(),
      type: itemType
    };
    return await actor.createEmbeddedDocuments('Item', [data]);
  }

  /**
   * Get the list of all available ingame items by Type.
   *
   * @param {string} item_type
   * @param {Object} game
   */
  /** //Accidentally duplicated this code before; I don't know if it works any differently
   static async getAllItemsByType(item_type, game) {

   let list_of_items = [];
   let game_items = [];
   let compendium_items = [];

   game_items = game.items.filter(e => e.type === item_type).map(e => {return e.toObject()});

   let pack = game.packs.find(e => e.metadata.name === item_type);
   let compendium_content = await pack.getDocuments();
   compendium_items = compendium_content.map(e => {return e.toObject()});

   list_of_items = game_items.concat(compendium_items);
   list_of_items.sort(function(a, b) {
     let nameA = a.name.toUpperCase();
     let nameB = b.name.toUpperCase();
   return nameA.localeCompare(nameB);
   });
   return list_of_items;

   }
   **/
  static async getAllItemsByType(item_type) {

    let list_of_items = [];
    let world_items = [];
    let compendium_items = [];

    if (item_type === "npc" || item_type === "crew") {
      world_items = game.actors.filter(e => e.type === item_type).map(e => {
        return e
      });
    } else {
      world_items = game.items.filter(e => e.type === item_type).map(e => {
        return e
      });
    }

    if (item_type != "crew") {
      let packs = game.packs.filter(e => e.metadata.name === item_type);
      let compendium_contents = await Promise.all(packs.map(pack => pack.getDocuments()));
      for(const compendium_content of compendium_contents) {
        compendium_items = compendium_items.concat(compendium_content)
      }
      list_of_items = world_items.concat(compendium_items);
    } else {
      list_of_items = world_items;
    }

    list_of_items.sort(function (a, b) {
      let nameA = a.name.toUpperCase();
      let nameB = b.name.toUpperCase();
      return nameA.localeCompare(nameB);
    });
    return list_of_items;

  }

  /* -------------------------------------------- */

  static resolveActor(obj, errorObj) {
    let objFull;
    if (obj) {
      if (obj.uuid) obj = obj.uuid;
      objFull = fromUuidSync(obj);
      if (!objFull)
        objFull = errorObj;
    } else
      objFull = null;
    return objFull;
  }

  /* -------------------------------------------- */

  /**
   * Returns the label for attribute.
   *
   * @param {string} attribute_name
   * @returns {string}
   */
  static getAttributeLabel(attribute_name) {
    let attribute_labels = {};
    const attributes = game.model.Actor.strider.attributes;

    for (const att_name in attributes) {
      attribute_labels[att_name] = attributes[att_name].label;
      for (const action_name in attributes[att_name].actions) {
        attribute_labels[action_name] = attributes[att_name].actions[action_name].label;
      }

    }

    return attribute_labels[attribute_name];
  }

  /**
   * Returns the label for roll type.
   *
   * @param {string} roll_name
   * @returns {string}
   */
  static getRollLabel(roll_name) {
    let attribute_labels = {};
    const attributes = game.model.Actor.strider.attributes;

    for (const att_name in attributes) {
      if (att_name == roll_name) {
        return attributes[att_name].label;
      }
      for (const action_name in attributes[att_name].actions) {
        if (action_name == roll_name) {
          return attributes[att_name].actions[action_name].label;
        }
      }
    }

    return roll_name;
  }

  /**
   * Returns true if the attribute is an action
   *
   * @param {string} attribute_name
   * @returns {Boolean}
   */
  static isAttributeAction(attribute_name) {
    const attributes = game.model.Actor.strider.attributes;

    for (const att_name in attributes) {
      for (const action_name in attributes[att_name].actions) {
        if (action_name == attribute_name) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Returns true if the attribute is an attribute
   *
   * @param {string} attribute_name
   * @returns {Boolean}
   */
  static isAttributeAttribute(attribute_name) {
    const attributes = game.model.Actor.strider.attributes;

    return (attribute_name in attributes);
  }

  /* -------------------------------------------- */

  static sortObjects(objs, fetchFunc, compareFunc, rebuildFunc, extraFields = []) {
    let objsFull = fetchFunc(objs, extraFields);
    let objsFullSortedArray = Object.values(objsFull).sort(compareFunc);
    return rebuildFunc(objsFullSortedArray, extraFields);
  }

  /* -------------------------------------------- */
  static getProperCase(name) {
    return name.charAt(0).toUpperCase() + name.substr(1).toLowerCase();
  }

  /**
   * Creates options for faction clocks.
   *
   * @param {int[]} sizes
   *  array of possible clock sizes
   * @param {int} default_size
   *  default clock size
   * @param {int} current_size
   *  current clock size
   * @returns {string}
   *  html-formatted option string
   */
  static createListOfClockSizes(sizes, default_size, current_size) {

    let text = ``;

    sizes.forEach(size => {
      text += `<option value="${size}"`;
      if (!(current_size) && (size === default_size)) {
        text += ` selected`;
      } else if (size === current_size) {
        text += ` selected`;
      }

      text += `>${size}</option>`;
    });

    return text;

  }

  static async getSourcedItemsByType(item_type) {
    const limited_items = await this.getAllItemsByType(item_type);
    return limited_items;
  }

  static async getItemByType(item_type, item_id) {
    let game_items = await this.getAllItemsByType(item_type);
    let item = game_items.find(item => item.id === item_id);
    return item;
  }

  // Sets the crew of a strider and add the strider to the crew's member list
  static async addCrewStrider(crewFull, striderFull, fromCrew) {
    if (striderFull.system.crew === crewFull.uuid) {
      BladesHelpers.printSameObjectError(fromCrew, 'crew', 'strider');
      return;
    }

    if (striderFull.system.crew)
      await BladesHelpers.removeCrewStrider(striderFull);
    let crewMembersArray = Object.values(crewFull.system.members);
    crewMembersArray.push({uuid: striderFull.uuid});
    crewMembersArray = BladesHelpers.sortObjects(crewMembersArray, BladesHelpers.fetchSimpleData, BladesHelpers._simpleCompareFunc, BladesHelpers.rebuildSimplesFromData);
    let newCrewMembers = Object.assign({}, crewMembersArray);
    await BladesHelpers.tryUpdate(crewFull, {system: {'==members': newCrewMembers}});
    await BladesHelpers.tryUpdate(striderFull, {system: {'==crew': crewFull.uuid}});
  }

  // Removes a strider's crew and remove the strider from its crew's member list
  static async removeCrewStrider(striderFull) {
    let crewFull = BladesHelpers.resolveActor(striderFull.system.crew);
    if (crewFull) {
      let crewMembersArray = Object.values(crewFull.system.members);
      crewMembersArray.splice(crewMembersArray.map(e => e.uuid).indexOf(striderFull.uuid), 1);
      let newCrewMembers = Object.assign({}, crewMembersArray);
      await BladesHelpers.tryUpdate(crewFull, {system: {'==members': newCrewMembers}});
    }
    await BladesHelpers.tryUpdate(striderFull, {system: {'==crew': null}});
  }

  static _crewMemberCompareFunc(a, b) {
    if (a.type != b.type)
      return a.type == 'strider' ? -1 : 1;
    return a.name.localeCompare(b.name, 'en-US');
  }

  /**
   * Groups items by their system.class property.
   * Items without a class are grouped under "General".
   *
   * @param {Array} item_list - Array of item objects
   * @returns {Object} Object with class names as keys and arrays of items as values
   */
  static groupItemsByClass(item_list) {
    let grouped_items = {};
    let generics = [];

    for (const item of item_list) {
      let itemclass = foundry.utils.getProperty(item, "system.class");
      if (!itemclass || itemclass === "") {
        generics.push(item);
      } else {
        if (!(itemclass in grouped_items) || !Array.isArray(grouped_items[itemclass])) {
          grouped_items[itemclass] = [];
        }
        grouped_items[itemclass].push(item);
      }
    }

    // Sort keys alphabetically and put generics last
    let sorted = {};
    Object.keys(grouped_items).sort().forEach(key => {
      sorted[key] = grouped_items[key];
    });
    if (generics.length > 0) {
      sorted["General"] = generics;
    }

    return sorted;
  }

  /**
   * Removes the class prefix from an item name.
   * e.g., "(Cutter) Not to be Trifled With" -> "Not to be Trifled With"
   *
   * @param {string} name - The item name
   * @returns {string} The name without the class prefix
   */
  static trimClassFromName(name) {
    return name.replace(/^\([^)]*\)\s*/, "");
  }

  /**
   * Strips HTML tags from a string.
   *
   * @param {string} html - HTML string to strip
   * @returns {string} Plain text without HTML tags
   */
  static stripHtml(html) {
    if (!html) return "";
    let doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  }

  /* -------------------------------------------- */

  static async sendClockStyleRequest() {
    // Send a specific message to the GM to update some data on their end
    let speaker = ChatMessage.getSpeaker();
    let messageData = {
      speaker: speaker,
      messageType: 'clockStylesRequest',
      userId: game.userId,
      content: '',
      blind: true,
      whisper: game.users.activeGM ? [game.users.activeGM.id] : game.users.filter(u => u.isGM).map(u => u.id)
    }
    let message = await SFTDChatMessage.create(messageData);

    if (!game.users.activeGM)
      // Notify the player that the data will be handled when a GM connects
      ui.notifications.warn(game.i18n.localize('SFTD.log.warn.ClockStylesRequestNoActiveGM'));
  }

  static async sendClockStyleResponseBroadcast() {
    for (const user of game.users.contents.filter(u => u.id != game.userId)) {
      let speaker = ChatMessage.getSpeaker();
      let messageData = {
        speaker: speaker,
        messageType: 'clockStylesResponse',
        clockStyles: BladesHelpers.clockStyles,
        content: '',
        blind: true,
        whisper: [user.id]
      }
      let message = await SFTDChatMessage.create(messageData);
    }
  }

  static handleClockImageError(ev) {
    let element = ev.currentTarget;
    element.src = 'systems/songs-for-the-dusk/themes/cross.png';
    element.parentElement.dataset.tooltip = game.i18n.format('SFTD.log.warn.NoClockImage', {
      theme: element.dataset.theme,
      color: element.dataset.color,
      size: element.dataset.size,
      fill: element.dataset.fill
    })
  }

  /* -------------------------------------------- */

  static clockStyles = {};

  static async loadAllClockStyles() {
    BladesHelpers.clockStyles = {};
    let clockStylesShifts = game.settings.get("songs-for-the-dusk", "ClockStyles").contents;

    const firstClockRegex = new RegExp('(?<size>[0-9]+)clock_0.(?<extension>.*)');
    const themeContainerFolders = [`worlds/${game.world.id}/themes`, 'systems/songs-for-the-dusk/themes'];
    for (const themeContainerFolder of themeContainerFolders) {
      let themeFolders;
      try {
        themeFolders = await foundry.applications.apps.FilePicker.browse('data', themeContainerFolder).then(f => f.dirs);
      } catch {
        // No themes folder, skip
        continue;
      }

      for (const themeFolder of themeFolders) {
        const theme = themeFolder.split('/').pop();
        const colorFolders = await foundry.applications.apps.FilePicker.browse('data', themeFolder).then(f => f.dirs);
        if (!BladesHelpers.clockStyles[theme])
          BladesHelpers.clockStyles[theme] = {};

        for (const colorFolder of colorFolders) {
          const color = colorFolder.split('/').pop();
          const filePaths = await foundry.applications.apps.FilePicker.browse('data', colorFolder).then(f => f.files);
          if (!BladesHelpers.clockStyles[theme][color])
            BladesHelpers.clockStyles[theme][color] = {};

          for (const fileData of filePaths.map(f => firstClockRegex.exec(f.split('/').pop())).filter(f => f != null)) {
            const fileName = fileData.input;
            const clockData = {
              theme: theme,
              color: color,
              size: fileData.groups.size,
              extension: fileData.groups.extension,
              inWorldFolder: themeFolder.startsWith('worlds/'),
              baseSprite: fileName,
              shifted: clockStylesShifts?.[theme]?.[color]?.[fileData.groups.size]?.shifted ?? false
            };

            let clockImages = {'0': {file: fileName}};
            const clockRegex = new RegExp(`${fileData.groups.size}clock_(?<state>[1-9][0-9]*).${fileData.groups.extension}`);
            const looseClockRegex = new RegExp(`${fileData.groups.size}clock_(?<state>[1-9][0-9]*).(?<extension>.*)`);
            for (let clockFileData of filePaths.map(f => clockRegex.exec(f.split('/').pop())).filter(f => f != null))
              if (clockFileData.index == 0)
                clockImages[clockFileData.groups.state] = {file: clockFileData.input};
            for (let clockFileData of filePaths.map(f => looseClockRegex.exec(f.split('/').pop())).filter(f => f != null))
              if (!clockImages[clockFileData.groups.state])
                if (clockFileData.index == 0)
                  clockImages[clockFileData.groups.state] = {file: clockFileData.input, dataReason: 'SFTD.Settings.ClockStyles.WrongExtension'};

            let reasons = [];
            for (let clockState of Array(Number(fileData.groups.size) + 1).fill().map((_, i) => String(i))) {
              const clockStateData = clockImages[clockState];
              if (!clockStateData)
                reasons.push(game.i18n.format('SFTD.Settings.ClockStyles.MissingClockState', {fill: clockState}));
              else if (clockStateData.dataReason == 'SFTD.Settings.ClockStyles.WrongExtension')
                reasons.push(game.i18n.format(clockStateData.dataReason, {fill: clockState, bad: clockStateData.file.split('.', 2).pop(), good: clockData.extension}));
              else if (clockStateData.dataReason)
                reasons.push(game.i18n.location(clockStateData.dataReason));
            }
            clockData.dataReason = reasons.join('<br/>');
            BladesHelpers.clockStyles[theme][color][fileData.groups.size] = clockData;
          }
          BladesHelpers.clockStyles[theme][color].dataReason = Object.entries(BladesHelpers.clockStyles[theme][color])
            .filter(s => s[0] != 'dataReason' && s[1].dataReason != '')
            .map(s => `${(s[1].dataReason ?? '')
              .split('<br/>')
              .map(s2 => `${game.i18n.localize('SFTD.Settings.ClockStyles.Size')} ${s[0]}: ${s2}`)
              .join('<br/>')}`)
            .join('<br/>');
        }
        BladesHelpers.clockStyles[theme].dataReason = Object.entries(BladesHelpers.clockStyles[theme])
          .filter(c => c[0] != 'dataReason' && c[1].dataReason != '')
          .map(c => `${(c[1].dataReason ?? '')
            .split('<br/>')
            .map(c2 => `${game.i18n.localize('SFTD.Settings.ClockStyles.Color')} ${c[0]}, ${c2}`)
            .join('<br/>')}`)
          .join('<br/>');
      }
      BladesHelpers.clockStyles = Object.fromEntries(Object.entries(BladesHelpers.clockStyles).sort((a, b) => a[0] ))
    }

    if (Object.keys(BladesHelpers.clockStyles).length == 0 && !game.user.isGM)
      await BladesHelpers.sendClockStyleRequest();
    if (game.user.isGM)
      await BladesHelpers.sendClockStyleResponseBroadcast();
  }

  /* -------------------------------------------- */

  static fetchSimpleData(simpleObjs, extraFields = [], compareFunc = undefined) {
    let simpleObjsFull = [];
    for (let simpleObj of Object.values(simpleObjs)) {
      let simpleObjFull = BladesHelpers.resolveActor(simpleObj.uuid);
      if (!simpleObjFull)
        continue;
      for (let extraField of extraFields)
        simpleObjFull.system[extraField] = simpleObj[extraField];
      simpleObjsFull.push(simpleObjFull);
    }
    if (compareFunc)
      simpleObjsFull = simpleObjsFull.sort(compareFunc);
    return simpleObjsFull;
  }

  static _simpleCompareFunc(a, b) {
    return a.name.localeCompare(b.name, 'en-US');
  }

  static rebuildSimplesFromData(simpleObjsFull, extraFields = []) {
    let simpleObjs = [];
    for (let simpleObjFull of Object.values(simpleObjsFull)) {
      let simpleObj = {uuid: simpleObjFull.uuid};
      for (let extraField of extraFields)
        simpleObj[extraField] = simpleObjFull.system[extraField];
      simpleObjs.push(simpleObj);
    }
    return simpleObjs;
  }
}

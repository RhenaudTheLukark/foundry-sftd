
import { BladesHelpers } from "./blades-helpers.js";
import { BladesSheet } from "./blades-sheet.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {BladesSheet}
 */
export class BladesClockSheet extends BladesSheet {

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
  	  classes: ["songs-for-the-dusk", "sheet", "actor", "clock"],
  	  template: "systems/songs-for-the-dusk/templates/actors/clock-sheet.html",
      width: 360,
      height: 400,
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    const superData = super.getData( options );
    const sheetData = superData.data;
    sheetData.owner = superData.owner;
    sheetData.editable = superData.editable;
    sheetData.isGM = game.user.isGM;

    let themeColor = sheetData.system.theme_color.split('/');
    let clockStyles = BladesHelpers.clockStyles;

    sheetData.themeColorDropdown = {};
    for (let [themeName, theme] of Object.entries(clockStyles))
      if (themeName != 'dataReason')
        for (let [colorName, color] of Object.entries(theme))
          if (colorName != 'dataReason')
            sheetData.themeColorDropdown[`${themeName}/${colorName}`] = `${themeName}/${colorName}`;

    sheetData.sizeDropdown = {};
    let addedCurrentSize = false;
    for (let [sizeName, size] of Object.entries(clockStyles[themeColor[0]][themeColor[1]]))
      if (sizeName != 'dataReason') {
        if (!addedCurrentSize) {
          if (sizeName == sheetData.system.size)
            addedCurrentSize = true;
          else if (sizeName < sheetData.system.size) {
            sheetData.sizeDropdown[sheetData.system.size] = sheetData.system.size;
            addedCurrentSize = true;
          }
        }
        sheetData.sizeDropdown[sizeName] = sizeName;
      }

    sheetData.system.theme = themeColor[0];
    sheetData.system.color = themeColor[1];

    return sheetData;
  }

  /* -------------------------------------------- */
  /** @override */
  async _updateObject(event, formData) {
    let clockStyles = BladesHelpers.clockStyles;
    let themeColor = formData['system.theme_color'].split('/');
    let clockColor = clockStyles?.[themeColor[0]]?.[themeColor[1]];
    if (clockColor === undefined) {
      formData['system.theme_color'] = 'default/black';
      this._updateObject(event, formData);
      return;
    }

    if (formData['system.value'] > formData['system.size'])
      formData['system.value'] = formData['system.size'];

    let clockData = clockColor[formData['system.size']];
    let imagePath;
    if (!clockData)
      imagePath = 'systems/songs-for-the-dusk/themes/error.png';
    else
      imagePath = `${BladesHelpers.getClockSpritePath(clockData)}${formData['system.size']}clock_${formData['system.value']}.${clockData.extension}`;

    formData['img'] = imagePath;
    formData['prototypeToken.texture.src'] = imagePath;

    let data = [];
    let update = { "texture.src": imagePath };

    let tokens = this.actor.getActiveTokens();
    tokens.forEach(function(token) {
      data.push(foundry.utils.mergeObject({ _id: token.id }, update));
    });
    if(game.scenes.current)
      await TokenDocument.updateDocuments(data, { parent: game.scenes.current })

    // Update the Actor
    return this.actor.update(formData);
  }
}

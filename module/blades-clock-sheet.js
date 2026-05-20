
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
	sheetData.sizeDropdown = {
		"4": "4",
		"6": "6",
		"8": "8",
		"10": "10",
		"12": "12",
	};
	sheetData.colorDropdown = {
		"black": "SFTD.Colors.Black",
		"blue": "SFTD.Colors.Blue",
		"green": "SFTD.Colors.Green",
		"grey": "SFTD.Colors.Grey",
		"red": "SFTD.Colors.Red",
		"white": "SFTD.Colors.White",
		"yellow": "SFTD.Colors.Yellow"
	};

    let clockStyles = game.settings.get("songs-for-the-dusk", "ClockStyles");
    sheetData.styleDropdown = {}
    for (let [index, style] of Object.entries(clockStyles.contents)) {
      sheetData.styleDropdown[Number(index)] = style.name;
    }

    let clockStyle = clockStyles.contents[sheetData.system.styleId];
    sheetData.isColored = clockStyle.isColored;
    sheetData.styleName = clockStyle.name;

    return sheetData;
  }

  /* -------------------------------------------- */
  /** @override */
  async _updateObject(event, formData) {
    let clockStyles = game.settings.get("songs-for-the-dusk", "ClockStyles");
    let clockStyle = clockStyles.contents[Number(formData['system.styleId'])];
    if (clockStyle === undefined) {
      formData['system.styleId'] = 0;
      this._updateObject(event, formData);
      return;
    }

    if (!clockStyle.isColored || formData['system.color'] === undefined)
      formData['system.color'] = "black";

    let clockStylePath = BladesHelpers.getClockStyleFolderPath(clockStyle, game);
    let imagePath = `${clockStylePath}/${formData['system.color']}/${formData['system.type']}clock_${formData['system.value']}.${clockStyle.imageType}`;
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

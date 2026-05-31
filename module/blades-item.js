import { BladesHelpers } from "./blades-helpers.js";
import { renderHandlebarsTemplate as renderTemplate } from "./compat.js";

/**
 * Extend the basic Item
 * @extends {Item}
 */
export class BladesItem extends Item {

  /** @override */
  async _preCreate( data, options, user ) {
    await super._preCreate( data, options, user );

    let removeItems = [];
    if( user.id === game.user.id ) {
      let actor = this.parent ? this.parent : null;
      if( actor?.documentName === "Actor" ) {
        removeItems = BladesHelpers.removeDuplicatedItemType( data, actor );
      }
      if( removeItems.length !== 0 ) {
        await actor.deleteEmbeddedDocuments( "Item", removeItems );
      }
    }
  }

  /* -------------------------------------------- */

  /* override */
  prepareData() {
    super.prepareData();

    const item_data = this.system;
    if (this.type === "cohort")
      this._prepareCohort(item_data);
  }

  /**
   * Prepares Cohort data
   *
   * @param {object} data
   */
  _prepareCohort(item_data) {

    let quality = 0;
    let scale = 0;

    // Adds Scale and Quality
    if (this.actor?.system) {
      switch (item_data.cohort) {
        case "Gang":
          scale = parseInt(this.actor.getTier());
          quality = parseInt(this.actor.getTier());
          break;
        case "Expert":
          scale = 0;
          quality = parseInt(this.actor.getTier()) + 1;
          break;
      }
    }

    this.system.scale = scale;
    this.system.quality = quality;
}

  async sendToChat() {
    const itemData = this.toObject();
    if (itemData.img.includes("/mystery-man")) {
      itemData.img = null;
    }
    const html = await renderTemplate("systems/songs-for-the-dusk/templates/chat/chat-item.html", itemData);
    const chatData = {
      user: game.userId,
      content: html,
    };
    const message = await ChatMessage.create(chatData);
  }
}

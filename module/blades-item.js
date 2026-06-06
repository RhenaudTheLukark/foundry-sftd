import { BladesHelpers } from "./blades-helpers.js";
import { renderHandlebarsTemplate as renderTemplate } from "./compat.js";

/**
 * Extend the basic Item
 * @extends {Item}
 */
export class BladesItem extends Item {

  /** @override */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    let removeItems = [];
    if (user.id === game.user.id) {
      let actor = this.parent ? this.parent : null;
      if (actor?.documentName === "Actor")
        removeItems = BladesHelpers.fetchDuplicatedItemType(data, actor);
      if (removeItems.length > 0)
        for (let removeItem of removeItems)
          await BladesHelpers.tryDelete(removeItem, actor);
    }
  }

  /** @override */
  async _onCreate(data, options, userId) {
    await super._onCreate(data, options, userId);

    if (this.type === "specialist") {
      const itemData = this.system;
      this.updateSpecialistQuality();
    }
  }

  async updateSpecialistQuality(forcedTier) {
    let quality = this.computeSpecialistQuality(forcedTier);
    await BladesHelpers.tryUpdate(this, {'system.quality': quality});
  }

  computeSpecialistQuality(forcedTier) {
    let quality = 0;

    // Adds Scale and Quality
    if (this.actor?.system) {
      let isHooked = this.actor.overrides?.system?.hooked || this.actor.system.hooked;
      quality = parseInt(forcedTier ?? this.actor.getTier()) + (isHooked ? 1 : 0) + this.system.quality_modifier;
    }

    return quality;
  }

  async sendToChat() {
    const itemData = this.toObject();
    if (itemData.img.includes("/mystery-man"))
      itemData.img = null;
    const html = await renderTemplate("systems/songs-for-the-dusk/templates/chat/chat-item.html", itemData);
    const chatData = {
      user: game.userId,
      content: html,
    };
    const message = await ChatMessage.create(chatData);
  }
}

import { BladesHelpers } from "./blades-helpers.js";
import { renderHandlebarsTemplate as renderTemplate } from "./compat.js";

/**
 * Extend the basic Item
 * @extends {Item}
 */
export class BladesItem extends Item {

  /** @override */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

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

    if (this.type == 'specialist')
      this.updateSpecialistQuality();
  }

  async updateSpecialistQuality(forcedTier) {
    let quality = this.computeSpecialistQuality(forcedTier);
    await BladesHelpers.tryUpdate(this, {'system.==quality': quality});
  }

  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if (allowed === false) return false;

    if (this.type == 'ability' && changed.system?.['==charm_ability'] != undefined) {
      const oldCharmAbility = this.system.charm_ability == 'none' ? null : this.parent.items.contents.find(i => i._id == this.system.charm_ability);
      if (oldCharmAbility)
        await BladesHelpers.tryUpdate(oldCharmAbility, {'system.==bound_by_charmtrick': false});
      const newCharmAbility = changed.system['==charm_ability'] == 'none' ? null : this.parent.items.contents.find(i => i._id == changed.system['==charm_ability']);
      if (newCharmAbility)
        await BladesHelpers.tryUpdate(newCharmAbility, {'system.==bound_by_charmtrick': true});
    }
  }

  /** @override */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);

    if (this.type == 'foundation' && (changed.system?.is_weather_damaged != undefined || changed.system?.is_under_disaster != undefined))
      await this.updateFoundation();
  }

  /** @override */
  async _onDelete(options, userId) {
    if (this.type == 'ability' && [undefined, 'none'].includes(this.system?.charm_ability))
      await BladesHelpers.tryUpdate(this.parent.items[this.system.charm_ability], {'system.==bound_by_charmtrick': false});

    await super._onDelete(options, userId);
  }

  async updateFoundation() {
    let isSuppressed = this.system.is_weather_damaged || this.system.is_under_disaster;

    if (this.system.suppressed != isSuppressed) {
      await BladesHelpers.tryUpdate(this, {'system.==suppressed': suppressed});
      if (isSuppressed)
        await BladesHelpers.preDeleteItem(this, false);
      else
        await BladesHelpers.postCreateItem(this);
    }
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

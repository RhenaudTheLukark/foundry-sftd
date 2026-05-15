import { BladesHelpers } from "../blades-helpers.js";

/**
 * ChatMessage used for requesting a data update from a player to the GM
 * @extends {foundry.documents.ChatMessage}
 */
export class SFTDChatMessage extends foundry.documents.ChatMessage {
  /** @override */
  _preCreate(data, options, user) {
    super._preCreate(data, options, user);
    this.updateSource({
      'system.groupActionCrew': data.groupActionCrew,
      'system.updateQuery': data.updateQuery,
      'system.updateDocumentUuid': data.updateDocumentUuid
    });
  }

  /** @override */
  get visible() {
    if (!this.system.updateQuery)
      return super.visible;

    // Hide the message from players, only the GM can see it
    if (this.whisper.length)
      return this.whisper.indexOf(game.user.id) !== -1;
    return false;
  }

  async renderHTML(options) {
    const html = await super.renderHTML(options);
    if (!this.system.updateQuery || this.system.handled)
      return html;

    $(html).addClass('update-message');

    // Perform the update operation, then delete the message
    let updateObject = JSON.parse(this.system.updateQuery);
    let document = BladesHelpers.resolveActor(this.system.updateDocumentUuid);
    if (document)
      await document.update(updateObject);
    await this.update({system: {'handled': true}});
    this.delete();
    return html;
  }
}

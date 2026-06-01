import { BladesHelpers } from "../blades-helpers.js";

/**
 * ChatMessage used for requesting a data update from a player to the GM
 * @extends {foundry.documents.ChatMessage}
 */
export class SFTDChatMessage extends foundry.documents.ChatMessage {
  static handledMessages = [];

  /** @override */
  _preCreate(data, options, user) {
    super._preCreate(data, options, user);
    this.updateSource({
      'system.messageType': data.messageType,
      'system.clockStyles': data.clockStyles,
      'system.userId': data.userId,
      'system.parentUuid': data.parentUuid,
      'system.objectEmbeddedName': data.objectEmbeddedName,
      'system.objectUuid': data.objectUuid,
      'system.objectData': data.objectData,
      'system.groupActionCrew': data.groupActionCrew,
      'system.updateQuery': data.updateQuery
    });
  }

  /** @override */
  get visible() {
    if (!this.system.messageType)
      return super.visible;

    // Hide the message from players
    if (this.whisper.length)
      return this.whisper.indexOf(game.user.id) !== -1;
    return false;
  }

  async renderHTML(options) {
    const html = await super.renderHTML(options);
    if (!this.system.messageType || SFTDChatMessage.handledMessages.includes(this._id))
      return html;

    $(html).addClass('special-message');
    SFTDChatMessage.handledMessages.push(this._id);
    if (SFTDChatMessage.handledMessages.length > 10)
      SFTDChatMessage.handledMessages.shift();

    let result;
    switch(this.system.messageType) {
      case 'createRequest':
        result = await this.handleCreateRequestMessage(html);
        break;
      case 'updateRequest':
        result = await this.handleUpdateRequestMessage(html);
        break;
      case 'deleteRequest':
        result = await this.handleDeleteRequestMessage(html);
        break;
      case 'clockStylesRequest':
        result = await this.handleClockStylesRequestMessage(html);
        break;
      case 'clockStylesResponse':
        result = await this.handleClockStylesResponseMessage(html);
        break;
      default:
        result = html;
    }

    if (this.canUserModify(game.user, 'update'))
      await this.update({system: {handled: true}});

    const id = this._id;
    await BladesHelpers.tryDelete(this);
    return result;
  }

  async handleCreateRequestMessage(html) {
    // Perform the create operation, then delete the message
    let parent = BladesHelpers.resolveActor(this.system.parentUuid);
    if (parent && this.system.objectEmbeddedName == 'Item')
      await Item.create(this.system.objectData, {parent: parent});
    return html;
  }

  async handleUpdateRequestMessage(html) {
    // Perform the update operation, then delete the message
    let updateObject = JSON.parse(this.system.updateQuery);
    let document = BladesHelpers.resolveActor(this.system.objectUuid);
    if (document)
      await document.update(updateObject);
    return html;
  }

  async handleDeleteRequestMessage(html) {
    // Perform the delete operation, then delete the message
    let parent = BladesHelpers.resolveActor(this.system.parentUuid);
    let document = BladesHelpers.resolveActor(this.system.objectUuid);
    if (document) {
      if (parent && this.system.objectEmbeddedName)
        await parent.deleteEmbeddedDocuments(this.system.objectEmbeddedName, document._id);
      else if (!parent && !this.system.objectEmbeddedName)
        await document.delete();
    }
    return html;
  }

  async handleClockStylesRequestMessage(html) {
    // Respond then delete the message
    let speaker = ChatMessage.getSpeaker();
    let messageData = {
      speaker: speaker,
      messageType: 'clockStylesResponse',
      clockStyles: BladesHelpers.clockStyles,
      content: '<div class="special-message"></div>',
      blind: true,
      whisper: [this.system.userId]
    }
    let message = await SFTDChatMessage.create(messageData);
    return html;
  }

  async handleClockStylesResponseMessage(html) {
    // Update the clock styles, then delete the message
    BladesHelpers.clockStyles = this.system.clockStyles;
    return html;
  }
}

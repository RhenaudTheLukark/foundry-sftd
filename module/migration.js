/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @return {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function() {
  ui.notifications.info(`Applying SFTD Actors migration for version ${game.system.data.version}. Please be patient and do not close your game or shut down your server.`, {permanent: true});

  // Set the migration as complete
  game.settings.set("songs-for-the-dusk", "systemMigrationVersion", game.system.version);
  ui.notifications.info(`SFTD System Migration to version ${game.system.version} completed!`, {permanent: true});
};


/* -------------------------------------------- */

/**
 * Migrate a single Scene entity to incorporate changes to the data model of it's actor data overrides
 * Return an Object of updateData to be applied
 * @param {Object} scene  The Scene data to Update
 * @return {Object}       The updateData to apply
 */
export const _migrateSceneData = function(scene) {
  return {}
};

/* -------------------------------------------- */

/* -------------------------------------------- */
/*  Entity Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate the actor attributes
 * @param {Actor} actor   The actor to Update
 * @return {Object}       The updateData to apply
 */
function _migrateActor(actor) {
  let updateData = {};
  return updateData;
}

/* -------------------------------------------- */


/**
 * Make Token be an Actor link.
 * @param {Actor} actor   The actor to Update
 * @return {Object}       The updateData to apply
 */
function _migrateTokenLink(actor) {
  let updateData = {};
  return updateData;
}

/* -------------------------------------------- */
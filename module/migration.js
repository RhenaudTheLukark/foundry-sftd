import { BladesHelpers } from "./blades-helpers.js";
import { ClockStylesData } from "./models/clock-styles.js";

/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @return {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function(oldVersion, newVersion) {
  ui.notifications.info(`Applying SFTD Actors migration for version ${game.system.version}. Please be patient and do not close your game or shut down your server.`, {permanent: true});

  // Migrate World Actors
  let actors = foundry.utils.deepClone(game.actors.contents);
  for (let a of actors) {
    try {
      const updateActorData = await _migrateActor(a, oldVersion);
      if (Object.keys(updateActorData).length > 0) {
        console.log(`Migrating ${game.i18n.localize(`TYPES.Actor.${a.type}`)} entity ${a.name}`);
        await BladesHelpers.tryUpdate(a, updateActorData);
      }

      // Migrate Actor Items as well
      for (let i of a.items.contents) {
        try {
          const updateItemData = await _migrateItem(i, oldVersion);
          if (Object.keys(updateItemData).length > 0) {
            console.log(`Migrating ${game.i18n.localize(`TYPES.Item.${i.type}`)} entity ${i.name} from ${game.i18n.localize(`TYPES.Actor.${a.type}`)} entity ${a.name}`);
            await BladesHelpers.tryUpdate(i, updateItemData);
          }
        } catch(err) {
          console.error(err);
        }
      }
    } catch(err) {
      console.error(err);
    }
  }

  // Migrate Items
  let items = foundry.utils.deepClone(game.items.contents);
  for (let i of items) {
    try {
      const updateData = await _migrateItem(i, oldVersion);
      if (Object.keys(updateData).length > 0) {
        console.log(`Migrating ${game.i18n.localize(`TYPES.Item.${i.type}`)} entity ${i.name}`);
        await BladesHelpers.tryUpdate(i, updateData);
      }
    } catch(err) {
      console.error(err);
    }
  }

  // Migrate Settings
  _migrateSettings(oldVersion);

  // Set the migration as complete
  game.settings.set("songs-for-the-dusk", "systemMigrationVersion", newVersion);
  ui.notifications.info(`SFTD System Migration to version ${game.system.version} completed!`, {permanent: true});
};

/* -------------------------------------------- */

/* -------------------------------------------- */
/*  Entity Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate the actor attributes
 * @param {Actor} actorFull   The actor to Update
 * @return {Object}       The updateData to apply
 */
function _migrateActor(actorFull, version) {
  let updateData = {};

  if (version < 1.2) {
    if (actorFull.type == 'strider') {
      updateData['system.downtime_count.base'] = 2;
      if (actorFull.system.downtime_count.value > 2)
        updateData['system.downtime_count.value'] = 2;
    }
  }

  return updateData;
}

/* -------------------------------------------- */

/**
 * Migrate the item attributes
 * @param {Item} itemFull    The item to Update
 * @return {Promise<Object>} The updateData to apply
 */
async function _migrateItem(itemFull, version) {
  let updateData = {};

  if (version < 1.3) {
    if (itemFull.type == 'specialist') {
      updateData['system.==armor'] = {
        'max': 0,
        'modifier': 0,
        'value': 0
      }
    }
  }

  return updateData;
}

/* -------------------------------------------- */

/**
 * Migrate the system's settings
 * @param {Number} version  Old version of the migration
 */
function _migrateSettings(version) {
  if (version < 1.2) {
    // Update Clock Styles
    let clockStyles = game.settings.get('songs-for-the-dusk', 'ClockStyles').contents;
    let defaultClockStyles = {
      sftd: {
        black: {
          2: {shifted: true},
          3: {shifted: true},
          4: {shifted: true},
          5: {shifted: true},
          6: {shifted: true},
          8: {shifted: true},
          10: {shifted: true},
          12: {shifted: true}
        },
        blue: {
          2: {shifted: true},
          3: {shifted: true},
          4: {shifted: true},
          5: {shifted: true},
          6: {shifted: true},
          8: {shifted: true},
          10: {shifted: true},
          12: {shifted: true}
        },
        green: {
          2: {shifted: true},
          3: {shifted: true},
          4: {shifted: true},
          5: {shifted: true},
          6: {shifted: true},
          8: {shifted: true},
          10: {shifted: true},
          12: {shifted: true}
        },
        grey: {
          2: {shifted: true},
          3: {shifted: true},
          4: {shifted: true},
          5: {shifted: true},
          6: {shifted: true},
          8: {shifted: true},
          10: {shifted: true},
          12: {shifted: true}
        },
        orange: {
          2: {shifted: true},
          3: {shifted: true},
          4: {shifted: true},
          5: {shifted: true},
          6: {shifted: true},
          8: {shifted: true},
          10: {shifted: true},
          12: {shifted: true}
        },
        pink: {
          2: {shifted: true},
          3: {shifted: true},
          4: {shifted: true},
          5: {shifted: true},
          6: {shifted: true},
          8: {shifted: true},
          10: {shifted: true},
          12: {shifted: true}
        },
        red: {
          2: {shifted: true},
          3: {shifted: true},
          4: {shifted: true},
          5: {shifted: true},
          6: {shifted: true},
          8: {shifted: true},
          10: {shifted: true},
          12: {shifted: true}
        },
        white: {
          2: {shifted: true},
          3: {shifted: true},
          4: {shifted: true},
          5: {shifted: true},
          6: {shifted: true},
          8: {shifted: true},
          10: {shifted: true},
          12: {shifted: true}
        },
        yellow: {
          2: {shifted: true},
          3: {shifted: true},
          4: {shifted: true},
          5: {shifted: true},
          6: {shifted: true},
          8: {shifted: true},
          10: {shifted: true},
          12: {shifted: true}
        }
      }
    };
    clockStyles = foundry.utils.mergeObject(clockStyles, defaultClockStyles);
    game.settings.set('songs-for-the-dusk', 'ClockStyles', new ClockStylesData({ contents: clockStyles }));
  }
}

/* -------------------------------------------- */
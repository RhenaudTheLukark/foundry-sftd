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
 * @param {Actor} actor   The actor to Update
 * @return {Object}       The updateData to apply
 */
function _migrateActor(actor, version) {
  let updateData = {};

  return updateData ?? {};
}

/* -------------------------------------------- */

/**
 * Migrate the system's settings
 * @param {Number} version  Old version of the migration
 */
function _migrateSettings(version) {
  if (version < 1.1) {
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
    game.settings.set('beamsaber', 'ClockStyles', new ClockStylesData({ contents: clockStyles }));
  }
}

/* -------------------------------------------- */
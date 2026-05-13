/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
import { loadHandlebarsTemplates } from "./compat.js";

export const preloadHandlebarsTemplates = async function() {

  // Define template paths to load
  const templatePaths = [

    // Actor Sheet Partials
    "systems/songs-for-the-dusk/templates/parts/attributes.html",
    "systems/songs-for-the-dusk/templates/parts/turf-list.html",
    "systems/songs-for-the-dusk/templates/parts/cohort-block.html",
    "systems/songs-for-the-dusk/templates/parts/factions.html",
    "systems/songs-for-the-dusk/templates/parts/active-effects.html",
  ];

  // Load the template parts
  return loadHandlebarsTemplates(templatePaths);
};

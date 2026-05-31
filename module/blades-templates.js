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
    "systems/songs-for-the-dusk/templates/parts/cohort-block.html",
    "systems/songs-for-the-dusk/templates/parts/relationship-block.html",
    "systems/songs-for-the-dusk/templates/parts/status-block.html",
    "systems/songs-for-the-dusk/templates/parts/active-effects.html",
    "systems/songs-for-the-dusk/templates/parts/item_display/ability.html",
    "systems/songs-for-the-dusk/templates/parts/item_display/crew_ability.html",
    "systems/songs-for-the-dusk/templates/parts/item_display/crew_upgrade.html",
    "systems/songs-for-the-dusk/templates/parts/item_display/item.html",
  ];

  // Load the template parts
  return loadHandlebarsTemplates(templatePaths);
};

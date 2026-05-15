export const registerSystemSettings = function() {

  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("songs-for-the-dusk", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
  
  if (foundry.utils.isNewerVersion(game.version, 12)) {

    game.settings.register('songs-for-the-dusk', 'ActionRoll', {
	name: game.i18n.localize('SFTD.Settings.Action.Name'),
	hint: game.i18n.localize('SFTD.Settings.Action.Hint'),
	config: true,
	default: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
	
	game.settings.register('songs-for-the-dusk', 'ThreatRoll', {
	name: game.i18n.localize('SFTD.Settings.Threat.Name'),
	hint: game.i18n.localize('SFTD.Settings.Threat.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
  
  game.settings.register('songs-for-the-dusk', 'PushYourself', {
	name: game.i18n.localize('SFTD.Settings.Push.Name'),
	hint: game.i18n.localize('SFTD.Settings.Push.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
  
    game.settings.register('songs-for-the-dusk', 'DeepCutLoad', {
	name: game.i18n.localize('SFTD.Settings.Load.Name'),
	hint: game.i18n.localize('SFTD.Settings.Load.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
  
  	game.settings.register('songs-for-the-dusk', 'PublicClocks', {
	name: game.i18n.localize('SFTD.Settings.PublicClocks.Name'),
	hint: game.i18n.localize('SFTD.Settings.PublicClocks.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
  
  } //end if for game.version >12
  else {
	  
  const set_array = [
    ['ActionRoll','Action', true],
    ['ThreatRoll','Threat', false],
    ['PushYourself','Push', false],
    ['DeepCutLoad','Load', false],
    ['PublicClocks','PublicClocks', false]
  ];
 
  for (let i=0; i<set_array.length; i++) {
	  
	game.settings.register('songs-for-the-dusk', set_array[i][0], {
		name: game.i18n.localize('SFTD.Settings.'+set_array[i][1]+'.Name'),
		hint: game.i18n.localize('SFTD.Settings.'+set_array[i][1]+'.Hint'),
		config: true,
		scope: 'world',
		type: Boolean,
		default: set_array[i][2],
		requiresReload: true
	});
  }
	  
  }

};

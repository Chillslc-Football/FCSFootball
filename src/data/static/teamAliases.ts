/**
 * Maps normalized ESPN team name variants to poll names in fcsTop25.json.
 * Keys must be lowercase normalized (see normalizeTeamName).
 */
export const FCS_TEAM_ALIASES: Record<string, string> = {
  'montana state bobcats': 'Montana State',
  'illinois state redbirds': 'Illinois State',
  'montana grizzlies': 'Montana',
  'north dakota state bison': 'North Dakota State',
  'ndsu': 'North Dakota State',
  'villanova wildcats': 'Villanova',
  'tarleton state texans': 'Tarleton State',
  'stephen f austin lumberjacks': 'Stephen F. Austin',
  'sfa': 'Stephen F. Austin',
  'uc davis aggies': 'UC Davis',
  'south dakota coyotes': 'South Dakota',
  'lehigh mountain hawks': 'Lehigh',
  'rhode island rams': 'Rhode Island',
  'abilene christian wildcats': 'Abilene Christian',
  'south dakota state jackrabbits': 'South Dakota State',
  'north dakota fighting hawks': 'North Dakota',
  'yale bulldogs': 'Yale',
  'tennessee tech golden eagles': 'Tennessee Tech',
  'mercer bears': 'Mercer',
  'youngstown state penguins': 'Youngstown State',
  'southeastern louisiana lions': 'Southeastern Louisiana',
  'harvard crimson': 'Harvard',
  'south carolina state bulldogs': 'South Carolina State',
  'monmouth hawks': 'Monmouth',
  'new hampshire wildcats': 'New Hampshire',
  'lamar cardinals': 'Lamar',
  'southern illinois salukis': 'Southern Illinois',
};

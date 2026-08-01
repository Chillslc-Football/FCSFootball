import { CONFERENCE_OPTIONS, TEAM_OPTIONS } from '../lib/catalog';

type Props = {
  isNational: boolean;
  teamIds: string[];
  conferenceIds: string[];
  teamSearch: string;
  onNationalChange: (value: boolean) => void;
  onTeamSearchChange: (value: string) => void;
  onToggleTeam: (id: string) => void;
  onToggleConference: (id: string) => void;
  extraTeams?: Array<{ id: string; label: string }>;
};

export function CoverageFields(props: Props) {
  const teams = [...TEAM_OPTIONS, ...(props.extraTeams ?? [])].filter(
    (team, index, all) => all.findIndex((item) => item.id === team.id) === index,
  );
  const filteredTeams = teams.filter((team) =>
    team.label.toLowerCase().includes(props.teamSearch.trim().toLowerCase()),
  );

  return (
    <div className="stack">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={props.isNational}
          onChange={(e) => props.onNationalChange(e.target.checked)}
        />
        National coverage
      </label>

      <label>
        Search teams
        <input
          value={props.teamSearch}
          onChange={(e) => props.onTeamSearchChange(e.target.value)}
          placeholder="Montana…"
        />
      </label>
      <div className="chips">
        {filteredTeams.map((team) => (
          <button
            key={team.id}
            type="button"
            className={`chip ${props.teamIds.includes(team.id) ? 'on' : ''}`}
            onClick={() => props.onToggleTeam(team.id)}
          >
            {team.label}
          </button>
        ))}
      </div>

      <div>
        <div className="muted" style={{ marginBottom: 8 }}>
          Conferences
        </div>
        <div className="chips">
          {CONFERENCE_OPTIONS.map((conference) => (
            <button
              key={conference.id}
              type="button"
              className={`chip ${props.conferenceIds.includes(conference.id) ? 'on' : ''}`}
              onClick={() => props.onToggleConference(conference.id)}
            >
              {conference.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

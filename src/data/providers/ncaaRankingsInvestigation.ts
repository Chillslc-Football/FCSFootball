/**
 * Structured findings from Phase 10 NCAA rankings investigation.
 * See NCAA_RANKINGS_INVESTIGATION.md for full report.
 */

export const NCAA_RANKINGS_INVESTIGATION = {
  officialUrl:
    'https://www.ncaa.com/rankings/football/fcs/stats-perform-fcs-top-25',
  drupalNodeId: '2917492',
  investigatedAt: '2026-07-02',

  findings: {
    hasOfficialJsonEndpoint: false,
    pageCallsRankingsApi: false,
    dataEmbeddedInHtml: true,
    alternateNcaaEndpointFound: false,
    reliableWithoutScraping: false,
  },

  probedEndpoints: [
    {
      url: 'https://www.ncaa.com/json/rankings/football/fcs/stats-perform-fcs-top-25',
      result: 'Connection closed / unavailable',
    },
    {
      url: 'https://www.ncaa.com/node/2917492?_format=json',
      result: '403 Forbidden',
    },
    {
      url: 'https://data.ncaa.com/casablanca/rankings/football/fcs/stats-perform-fcs-top-25',
      result: '404 Not Found',
    },
    {
      url: 'https://data.ncaa.com/casablanca/scoreboard/football/fcs/{year}/{month}/scoreboard.json',
      result: '200 OK for scoreboards — rankings path not available',
    },
  ],

  recommendedRetrieval: 'server_side_cache' as const,
  recommendedRetrievalSummary:
    'Server-side HTML fetch + parse + JSON cache. Mobile app calls your API only — never NCAA HTML.',

  refreshStrategy: {
    inSeasonTtlMinutes: 60,
    offseasonTtlHours: 24,
    suggestedTrigger: 'Sunday evenings ET after FCS games; Monday morning cron fallback',
  },

  pollSchedule: {
    publisher: 'Stats Perform',
    frequency: 'Weekly during FCS regular season and playoffs',
    typicalRelease: 'Sunday after weekend games',
    finalPollNote: 'Last observed update: Through Games JAN. 5, 2026',
  },

  scrapingRisks: [
    'Drupal HTML table structure can change without notice',
    'Mobile clients may be blocked or rate-limited',
    '~190 KB HTML payload for 25 rows is inefficient on cellular',
    'School names need normalization (e.g. "Montana State (56)", tie ranks "T4")',
    'No stable NCAA team IDs in rankings table — merge with ESPN requires alias map',
  ],

  productionStatus: 'stub_only' as const,
} as const;

export type NcaaRankingsRetrievalMethod =
  | 'server_side_cache'
  | 'stats_perform_license'
  | 'direct_mobile_scrape';

export type NcaaRankingsProductionStatus = 'stub_only' | 'live';

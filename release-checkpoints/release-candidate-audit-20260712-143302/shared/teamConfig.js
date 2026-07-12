(function initPondTeamConfig(root, factory) {
  const teamConfig = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = teamConfig;
  else root.PondTeams = teamConfig;
})(typeof globalThis !== "undefined" ? globalThis : window, function makeTeamConfig() {
  const TEAM_COLORS = [
    { id: "blue", name: "Pond Team", color: "#4fb7e8", badge: "P" },
    { id: "green", name: "Marsh Team", color: "#65ce8f", badge: "M" },
    { id: "gold", name: "Lily Team", color: "#e0bd64", badge: "L" },
    { id: "red", name: "River Team", color: "#e66f67", badge: "R" },
  ];

  return {
    modes: {
      solo: {
        id: "solo",
        label: "Solo",
        description: "Every animal plays for itself. Alliances still work.",
      },
      coop: {
        id: "coop",
        label: "Co-Op Team",
        description: "Start with teammate bots and win together.",
      },
      teamBattle: {
        id: "teamBattle",
        label: "Team Battle",
        description: "Several colored teams fight for combined lake control.",
      },
    },
    teams: TEAM_COLORS,
    roles: {
      guardian: { label: "Guardian", description: "Defends teammate borders and answers help pings." },
      attacker: { label: "Attacker", description: "Pushes weak enemy fronts and follows attack pings." },
      builder: { label: "Builder", description: "Builds economy and captures support zones." },
      scout: { label: "Scout", description: "Expands toward objectives and keeps vision pressure." },
      commander: { label: "Commander", description: "Human team leader." },
      rival: { label: "Rival", description: "Independent pond commander." },
    },
    commands: {
      attack: { label: "Attack Here", short: "Attack", pingType: "attack", tone: "#e9857c" },
      defend: { label: "Defend Here", short: "Defend", pingType: "defend", tone: "#83dced" },
      help: { label: "Request Help", short: "Help", pingType: "help", tone: "#f0cc74" },
      push: { label: "Push This Border", short: "Push", pingType: "attack", tone: "#d96b61" },
      objective: { label: "Capture Objective", short: "Objective", pingType: "objective", tone: "#77d99e" },
      retreat: { label: "Retreat / Stop", short: "Retreat", pingType: "danger", tone: "#b5c6d0" },
      protect: { label: "Protect My Border", short: "Protect", pingType: "defend", tone: "#9ee7f4" },
    },
    teamWinControl: 0.7,
  };
});

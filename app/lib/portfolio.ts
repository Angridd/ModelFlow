export type PortfolioScenario = {
  npv: number;
  irr: number;
};

export type PortfolioProject = {
  scenarios: PortfolioScenario[];
};

export function bestNpv(project: PortfolioProject) {
  if (project.scenarios.length === 0) {
    return null;
  }

  return Math.max(...project.scenarios.map((scenario) => scenario.npv));
}

export function bestIrr(project: PortfolioProject) {
  if (project.scenarios.length === 0) {
    return null;
  }

  return Math.max(...project.scenarios.map((scenario) => scenario.irr));
}

export function scenarioCount(project: PortfolioProject) {
  return project.scenarios.length;
}

export const physicsConfig = {
  gravityY: 1.0,
  positionIterations: 8,
  velocityIterations: 6,
  constraintIterations: 2,
  enableSleeping: true,
  sleepThreshold: 60,
  timeScale: 1,
  // per-tier multipliers applied in fruitConfig
  restitutionClamp: [0.05, 0.55] as const,
  frictionClamp: [0.05, 0.6] as const,
  densityBase: 0.0012,
} as const;

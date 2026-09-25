export type Point = { x: number; y: number; z: number };
export type Config = {
  mode: "single" | "multi";
  preset: "interface" | "benchmark";
  width: number;
  height: number;
  spacing: number;
  beadWidth: number;
  layerHeight: number;
  layers: number;
  pattern: "parallel" | "chevron" | "ribs";
  acceptance: "uniform" | "graded";
  tolerance: number;
  transitionVolume: number;
  eligibleLow: number;
  eligibleHigh: number;
  gamma: number;
  direction: "AB" | "BA";
  materialA: string;
  materialB: string;
  alpha: number;
  iterations: number;
  seed: number;
  replicates: number;
  depositSpeed: number;
  travelSpeed: number;
  purgeRate: number;
};
export type Segment = {
  id: number;
  label: string;
  layer: number;
  points: Point[];
  length: number;
  volume: number;
  low: number;
  high: number;
};
export type Choice = { id: number; reverse: boolean };
export type Step = Choice & {
  start: number;
  end: number;
  purgeBefore: number;
  travel: number;
  cStart: number;
  cEnd: number;
  travelFrom: Point;
  travelTo: Point;
};
export type Result = {
  algorithm: string;
  steps: Step[];
  unassigned: number[];
  complete: boolean;
  used: number;
  discarded: number;
  travel: number;
  depositionLength: number;
  idealTime: number;
  score: number;
  coverage: number;
  trace: { evaluation: number; score: number; assigned: number }[];
  seed?: number;
  evaluations: number;
  runtimeMs: number;
};
export type Run = {
  schema: "infilllab/1";
  modelVersion: "1.0.0";
  createdAt: string;
  config: Config;
  segments: Segment[];
  results: Result[];
  replicates: Result[];
};
export const DEFAULT: Config = {
  mode: "multi",
  preset: "interface",
  width: 40,
  height: 18,
  spacing: 2,
  beadWidth: 0.5,
  layerHeight: 0.2,
  layers: 1,
  pattern: "parallel",
  acceptance: "graded",
  tolerance: 0.22,
  transitionVolume: 60,
  eligibleLow: 0.1,
  eligibleHigh: 0.9,
  gamma: 1,
  direction: "AB",
  materialA: "Material A",
  materialB: "Material B",
  alpha: 0.65,
  iterations: 160,
  seed: 42,
  replicates: 3,
  depositSpeed: 30,
  travelSpeed: 100,
  purgeRate: 4,
};
export const BENCHMARK: Config = {
  ...DEFAULT,
  preset: "benchmark",
  width: 70,
  height: 10,
  layers: 1,
  transitionVolume: 12,
  eligibleLow: 0,
  eligibleHigh: 1,
  gamma: 1,
  direction: "AB",
  acceptance: "graded",
  iterations: 80,
  replicates: 3,
};

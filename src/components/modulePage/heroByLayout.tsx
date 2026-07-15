import type { ComponentType } from 'react';
import type { ModuleConfig } from '../../pages/moduleData';
import FlowHero from './FlowHero';
import StructureHero from './StructureHero';
import TerrainHero from './TerrainHero';
import BimHero from './BimHero';
import ManageHero from './ManageHero';
import MepHero from './MepHero';
import RoadsHero from './RoadsHero';

export const HERO_BY_LAYOUT: Record<NonNullable<ModuleConfig['customLayout']>, ComponentType<{ cfg: ModuleConfig }>> = {
  flow: FlowHero,
  structure: StructureHero,
  terrain: TerrainHero,
  bim: BimHero,
  manage: ManageHero,
  mep: MepHero,
  roads: RoadsHero,
};

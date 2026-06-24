export const ENTITY_ORCHESTRATION = {
  entity: 'Entity',
  dealer: 'Dealer',
  brands: 'Brands',
  location: 'Location',
};

export const ENTITY_ORCHESTRATION_PATH = [
  ENTITY_ORCHESTRATION.entity,
  ENTITY_ORCHESTRATION.dealer,
  ENTITY_ORCHESTRATION.brands,
  ENTITY_ORCHESTRATION.location,
] as const;

export const ENTITY_ORCHESTRATION_LABEL = ENTITY_ORCHESTRATION_PATH.join(' -> ');
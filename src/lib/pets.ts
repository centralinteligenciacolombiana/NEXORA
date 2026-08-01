export const PET_SPECIES_OPTIONS = [
  "Perro",
  "Gato",
  "Ave",
  "Conejo",
  "Otro",
] as const;

export type PetSpeciesOption = (typeof PET_SPECIES_OPTIONS)[number];

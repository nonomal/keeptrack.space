/**
 * Base class for rendering dwarf planets (Pluto, Makemake, etc.)
 * Thin subclass of ChebyshevBody for semantic typing in Scene.dwarfPlanets.
 */
import { ChebyshevBody } from './chebyshev-body';

export abstract class DwarfPlanet extends ChebyshevBody {
  // All Chebyshev interpolation logic is in ChebyshevBody.
  // This class exists for type distinction between dwarf planets and other Chebyshev-based bodies.
}

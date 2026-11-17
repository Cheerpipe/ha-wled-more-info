import { isDefined, whenDefined } from "../ha/internals";
import { LIGHT_TAGS } from "./state-controls";

/**
 * Native more-info controls are lazy chunks. `importMoreInfoControl(domain)`
 * (public card helper) imports the domain's more-info control, which
 * registers its building blocks (state header, state controls, select menu,
 * chips container…). It returns nothing, so wait for the tags themselves.
 */
export const ensureMoreInfoElements = async (
  domain: string,
  tags: string[],
): Promise<boolean> => {
  if (tags.every(isDefined)) return true;
  try {
    const helpers = await window.loadCardHelpers?.();
    helpers?.importMoreInfoControl?.(domain);
  } catch (err) {
    console.warn("[wled-more-info] Could not load", domain, err);
  }
  const results = await Promise.all(tags.map((tag) => whenDefined(tag, 8000)));
  return results.every(Boolean);
};

/**
 * The native chunks the WLED card draws with: the light more-info's controls
 * and pickers, and the vacuum one's select container and buttons (effects).
 */
export const WLED_CARD_LOADS = [
  [
    "light",
    [
      "ha-state-control-light-brightness",
      "ha-more-info-state-header",
      "ha-hs-color-picker",
      "ha-control-slider",
      ...LIGHT_TAGS,
    ],
  ],
  [
    "vacuum",
    [
      "ha-more-info-control-select-container",
      "ha-control-button",
      "ha-control-button-group",
    ],
  ],
] as const;

export const wledCardElementsDefined = (): boolean =>
  WLED_CARD_LOADS.every(([, tags]) => tags.every(isDefined));

/**
 * Loads the WLED card's native chunks. Until they arrive its controls draw
 * empty, so a dialog opened meanwhile opens short and grows.
 */
export const loadWledCardElements = async (): Promise<boolean> => {
  if (wledCardElementsDefined()) return true;
  const results = await Promise.all(
    WLED_CARD_LOADS.map(([domain, tags]) =>
      ensureMoreInfoElements(domain, [...tags]),
    ),
  );
  return results.every(Boolean);
};

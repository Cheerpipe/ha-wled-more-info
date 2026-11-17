/**
 * Prepares the WLED card in the background once Home Assistant has loaded:
 * the native chunks it draws with and the lights' data (links, effects and
 * palettes, segment state). Even the first opening then draws complete, at
 * its final size, with every button and the presets.
 */
import { loadWledCardElements } from "./controls/loader";
import type { HomeAssistant } from "./ha/types";
import { isWledLight } from "./native-more-info";
import { getSegments, type WledTarget } from "./wled/api";
import { loadEffects } from "./wled/effect-picker";
import { resolveWledLight } from "./wled/link";

const HASS_WAIT_MS = 60000;
const HASS_POLL_MS = 500;

const whenIdle = () =>
  new Promise<void>((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 2000 });
    } else {
      setTimeout(resolve, 200);
    }
  });

const appHass = (): HomeAssistant | undefined =>
  (
    document.querySelector("home-assistant") as
      (Element & { hass?: HomeAssistant }) | null
  )?.hass;

const waitForHass = async (): Promise<HomeAssistant | undefined> => {
  for (let waited = 0; waited < HASS_WAIT_MS; waited += HASS_POLL_MS) {
    const hass = appHass();
    if (hass?.entities && Object.keys(hass.states).length) return hass;
    await new Promise((resolve) => setTimeout(resolve, HASS_POLL_MS));
  }
  return undefined;
};

/**
 * The data of one light's device (link, effects, segments), cached for the
 * page. Resolves with its device, or undefined when it is not a WLED light.
 */
export const preloadWledLight = async (
  hass: HomeAssistant,
  entityId: string,
  skip?: ReadonlySet<string>,
): Promise<string | undefined> => {
  const link = await resolveWledLight(hass, entityId);
  if (typeof link !== "object") return undefined;
  if (skip?.has(link.deviceId)) return link.deviceId;
  const target: WledTarget = {
    hass,
    entityId: link.entityId,
    deviceId: link.deviceId,
  };
  await loadEffects(target);
  await getSegments(target);
  return link.deviceId;
};

/**
 * While the browser is idle: the card's native chunks, then (with `data`)
 * each light's data, one at a time. Errors are ignored.
 */
export const preloadWledLights = async ({
  data,
}: {
  data: boolean;
}): Promise<void> => {
  const hass = await waitForHass();
  if (!hass) return;
  const lights = Object.keys(hass.states).filter((id) => isWledLight(hass, id));
  if (!lights.length) return;
  await whenIdle();
  await loadWledCardElements().catch(() => false);
  if (!data) return;
  const devices = new Set<string>();
  for (const entityId of lights) {
    await whenIdle();
    try {
      const deviceId = await preloadWledLight(hass, entityId, devices);
      if (deviceId) devices.add(deviceId);
    } catch {
      // The card loads it again when opened.
    }
  }
};

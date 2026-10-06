/** What the browser says about the device, gathered in one place so the decision below stays a pure function. */
export interface DeviceHints {
  userAgent: string;
  /** navigator.userAgentData.mobile where the browser has it (Chromium), otherwise undefined */
  uaMobile?: boolean;
  /** the main pointer is a finger rather than a mouse or trackpad */
  coarsePointer: boolean;
  /** the shorter side of the screen in CSS pixels */
  shortSide: number;
}

// "Mobi" covers Android phones and iOS; iPads are left out because Chrome on iPad also says "Mobile"
const PHONE_UA = /Mobi|iPhone|iPod|Android.+Mobile|Windows Phone|IEMobile|Opera Mini/i;
const TABLET_UA = /iPad|Tablet/i;

/**
 * True for a phone browser, which gets the "coming soon" screen instead of the app. Tablets and desktops pass.
 * A phone that asks for the desktop site sends a desktop user agent, so a small touch screen also counts.
 */
export function isPhone(hints: DeviceHints): boolean {
  const smallTouchScreen = hints.coarsePointer && hints.shortSide > 0 && hints.shortSide < 600;
  if (TABLET_UA.test(hints.userAgent)) return smallTouchScreen;
  return hints.uaMobile === true || PHONE_UA.test(hints.userAgent) || smallTouchScreen;
}

export function readDeviceHints(): DeviceHints {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return {
    userAgent: nav.userAgent,
    uaMobile: nav.userAgentData?.mobile,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    shortSide: Math.min(window.screen?.width ?? 0, window.screen?.height ?? 0),
  };
}

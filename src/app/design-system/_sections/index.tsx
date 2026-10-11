/* Slug → section component. Server component imports; each section decides for itself whether it needs to be a client component. */
import { OverviewSection } from "./Overview";
import { ColourSection } from "./Colour";
import { TypographySection } from "./Typography";
import { SpacingSection } from "./Spacing";
import { RadiusSection } from "./Radius";
import { BordersSection } from "./Borders";
import { ElevationSection } from "./Elevation";
import { MotionSection } from "./Motion";
import { IconographySection } from "./Iconography";
import { ThemesSection } from "./Themes";
import { ButtonsSection } from "./Buttons";
import { StatesSection } from "./States";
import { CardsSection } from "./Cards";
import { InputsSection } from "./Inputs";
import { SelectionSection } from "./Selection";
import { NavigationSection } from "./Navigation";
import { DataDisplaySection } from "./DataDisplay";
import { FeedbackSection } from "./Feedback";
import { OverlaysSection } from "./Overlays";
import { OsPatternsSection } from "./OsPatterns";
import { GoPatternsSection } from "./GoPatterns";
import { AccessibilitySection } from "./Accessibility";

export const SECTION_COMPONENTS: Record<string, () => React.ReactNode> = {
  "overview": OverviewSection,
  "colour": ColourSection,
  "typography": TypographySection,
  "spacing": SpacingSection,
  "radius": RadiusSection,
  "borders": BordersSection,
  "elevation": ElevationSection,
  "motion": MotionSection,
  "iconography": IconographySection,
  "themes": ThemesSection,
  "buttons": ButtonsSection,
  "states": StatesSection,
  "inputs": InputsSection,
  "selection": SelectionSection,
  "navigation": NavigationSection,
  "cards": CardsSection,
  "data-display": DataDisplaySection,
  "feedback": FeedbackSection,
  "overlays": OverlaysSection,
  "os-patterns": OsPatternsSection,
  "go-patterns": GoPatternsSection,
  "accessibility": AccessibilitySection,
};

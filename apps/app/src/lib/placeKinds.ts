import type { PlaceKind } from "@app/shared";
import {
  Briefcase,
  Building,
  Ellipsis,
  GraduationCap,
  House,
  type LucideIcon,
  Map as MapIcon,
} from "lucide-react-native";
import { t } from "../texts";

/** Kinds of place in the design's order (E-NoweMiejsceTyp): name, hint and icon (COMPONENTS.md → Icon). */
export const PLACE_KIND_OPTIONS: { kind: PlaceKind; label: string; hint: string; icon: LucideIcon }[] = [
  { kind: "estate", label: t.place_kind_estate, hint: t.place_kind_estate_hint, icon: House },
  { kind: "building", label: t.place_kind_building, hint: t.place_kind_building_hint, icon: Building },
  { kind: "company", label: t.place_kind_company, hint: t.place_kind_company_hint, icon: Briefcase },
  { kind: "school", label: t.place_kind_school, hint: t.place_kind_school_hint, icon: GraduationCap },
  { kind: "district", label: t.place_kind_district, hint: t.place_kind_district_hint, icon: MapIcon },
  { kind: "other", label: t.place_kind_other, hint: t.place_kind_other_hint, icon: Ellipsis },
];

/** Name of a kind of place, e.g. "Budynek" (place switcher rows). */
export const placeKindLabel = (kind: PlaceKind): string =>
  PLACE_KIND_OPTIONS.find((option) => option.kind === kind)?.label ?? t.place_kind_other;

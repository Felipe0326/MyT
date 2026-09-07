export type SectionAvailability = "disponible" | "proximamente";

export type SectionIcon =
  | "layout-dashboard"
  | "activity"
  | "refresh-cw"
  | "file-text";

export type SectionAdminRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: SectionIcon;
  sort_order: number;
  availability: SectionAvailability;
  is_active: boolean;
  implemented: boolean;
  implementation_slug: string | null;
};

export type SectionsAdminPayload = {
  sections: SectionAdminRecord[];
};

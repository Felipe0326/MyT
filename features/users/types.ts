import type { AppRole } from "@/lib/session";

export type UserRecord = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: "activo" | "inactivo";
  created_at: string;
};

export type SectionRecord = {
  id: string;
  slug: string;
  title: string;
  availability: string;
  is_active: boolean;
};

export type PermissionRecord = {
  user_id: string;
  section_id: string;
  can_view: boolean;
};

export type InvitationRecord = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: string;
  expires_at: string;
  sent_at: string | null;
  send_count: number;
};

export type AdminPayload = {
  users: UserRecord[];
  sections: SectionRecord[];
  permissions: PermissionRecord[];
  invitations: InvitationRecord[];
  invitationPermissions: Array<{ invitation_id: string; section_id: string }>;
};

export type MutateMethod = "POST" | "PATCH" | "DELETE";

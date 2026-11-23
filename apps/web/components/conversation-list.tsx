// Ligne de la liste des discussions ; l’affichage est dans views/messaging/conversation-list (refonte D-135, D-145).

export interface ConversationRow {
  key: string;
  href: string;
  name: string;
  team: boolean;
  initials: string;
  preview: string;
  when: string | null;
  unread: number;
  active: boolean;
}

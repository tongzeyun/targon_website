/** Contact mutation decision for account detail save. */

export type ContactSaveFlags = {
  id?: string;
  _new?: boolean;
  _deleted?: boolean;
  _edit?: boolean;
};

export type ContactSaveAction = "skip" | "delete" | "create" | "update";

/**
 * Deleted drafts win even when also marked `_new` (unsaved rows have no id).
 * Order: deleted → new → edit → skip.
 */
export function resolveContactSaveAction(contact: ContactSaveFlags): ContactSaveAction {
  if (contact._deleted) {
    return contact.id ? "delete" : "skip";
  }
  if (contact._new) {
    return "create";
  }
  if (contact._edit && contact.id) {
    return "update";
  }
  return "skip";
}

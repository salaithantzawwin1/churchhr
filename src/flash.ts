import type { Flash } from "./views/layout";
import { getDict, normalizeLang, type Lang } from "./i18n";

/** Flash code (query param) -> i18n dictionary key. */
const FLASH_KEYS: Record<string, string> = {
  "member-created": "flash.memberCreated",
  "member-updated": "flash.memberUpdated",
  "member-deleted": "flash.memberDeleted",
  "user-created": "flash.userCreated",
  "user-updated": "flash.userUpdated",
  "role-created": "flash.roleCreated",
  "role-updated": "flash.roleUpdated",
  "role-deleted": "flash.roleDeleted",
  "option-added": "flash.optionAdded",
  "option-updated": "flash.optionUpdated",
  "option-deleted": "flash.optionDeleted",
  "option-deactivated": "flash.optionDeactivated",
  "age-group-added": "flash.ageGroupAdded",
  "age-group-updated": "flash.ageGroupUpdated",
  "age-group-deleted": "flash.ageGroupDeleted",
  "region-added": "flash.regionAdded",
  "region-updated": "flash.regionUpdated",
  "region-deleted": "flash.regionDeleted",
  "err-region-used": "flash.errRegionUsed",
  "err-scope": "flash.errScope",
  "err-notfound": "flash.errNotfound",
  "err-perm": "flash.errPerm",
  "err-systemrole": "flash.errSystemrole",
  "err-used": "flash.errUsed",
};

export function flashFromQuery(q: Record<string, string | undefined>, lang?: Lang): Flash {
  const t = getDict(normalizeLang(lang));
  const ok = q.ok;
  const err = q.err;
  if (ok && FLASH_KEYS[ok]) return { kind: "ok", text: t(FLASH_KEYS[ok]) };
  if (err && FLASH_KEYS[err]) return { kind: "err", text: t(FLASH_KEYS[err]) };
  if (err) return { kind: "err", text: err }; // fallback: literal message (escaped by JSX)
  return null;
}

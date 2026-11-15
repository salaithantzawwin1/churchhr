import type { Flash } from "./views/layout";
import { getDict, normalizeLang, type Lang } from "./i18n";

/** Flash code (query param) -> i18n dictionary key. */
export const FLASH_KEYS: Record<string, string> = {
  // The pastor photo error is stored under an unprefixed dictionary key.
  "pastor-photo-invalid": "pastor-photo-invalid",
  "member-created": "flash.memberCreated",
  "report-created": "flash.reportCreated",
  "report-draft": "flash.reportDraftSaved",
  "report-submitted": "flash.reportSubmitted",
  "report-reviewed": "flash.reportReviewed",
  "report-updated": "flash.reportUpdated",
  "report-unchanged": "flash.reportUnchanged",
  "report-deleted": "flash.reportDeleted",
  "member-updated": "flash.memberUpdated",
  "member-deleted": "flash.memberDeleted",
  "member-position": "flash.positionSaved",
  "church-leader-saved": "flash.churchLeaderSaved",
  "church-leader-cleared": "flash.churchLeaderCleared",
  "region-position-conflict": "flash.regionPositionConflict",
  "position-parent-invalid": "flash.positionParentInvalid",
  "position-church-invalid": "position-church-invalid",
  "position-parent-cycle": "flash.positionParentCycle",
  "position-taken": "flash.positionTaken",
  "position-no-home-cell": "flash.positionNoHomeCell",
  "position-invalid": "flash.positionInvalid",
  "department-created": "flash.departmentCreated",
  "department-updated": "flash.departmentUpdated",
  "department-name-required": "flash.departmentNameRequired",
  "department-name-long": "flash.departmentNameLong",
  "department-name-taken": "flash.departmentNameTaken",
  "department-in-use": "flash.departmentInUse",
  "position-created": "flash.positionCreated",
  "position-updated": "flash.positionUpdated",
  "position-deleted": "flash.positionDeleted",
  "position-in-use": "flash.positionInUse",
  "position-holder-removed": "flash.positionHolderRemoved",
  "position-name-mm": "flash.positionNameMmRequired",
  "position-name-en": "flash.positionNameEnRequired",
  "position-name-long": "flash.positionNameLong",
  "position-code-taken": "flash.positionCodeTaken",
  "regional-created": "flash.regionalCreated",
  "regional-updated": "flash.regionalUpdated",
  "regional-deleted": "flash.regionalDeleted",
  "regional-in-use": "flash.regionalInUse",
  "regional-state-locked": "flash.regionalStateLocked",
  "regional-name-required": "flash.regionalNameRequired",
  "regional-name-taken": "flash.regionalNameTaken",
  "regional-state-required": "flash.regionalStateRequired",
  "regional-cell-invalid": "flash.regionalCellInvalid",
  "cluster-created": "flash.clusterCreated",
  "cluster-updated": "flash.clusterUpdated",
  "cluster-deleted": "flash.clusterDeleted",
  "cluster-cells": "flash.clusterCells",
  "cluster-name-required": "cluster-name-required",
  "cluster-state-required": "cluster-state-required",
  "cluster-name-taken": "cluster-name-taken",
  "cluster-state-locked": "cluster-state-locked",
  "cluster-in-use": "cluster-in-use",
  "cluster-cell-invalid": "cluster-cell-invalid",
  "cluster-pastor-invalid": "cluster-pastor-invalid",
  "pastor-created": "flash.pastorCreated",
  "pastor-updated": "flash.pastorUpdated",
  "pastor-deleted": "flash.pastorDeleted",
  "pastor-history-saved": "flash.pastorHistorySaved",
  "pastor-history-deleted": "flash.pastorHistoryDeleted",
  "edu-saved": "flash.eduSaved",
  "edu-deleted": "flash.eduDeleted",
  "pastor-child-saved": "flash.childSaved",
  "pastor-child-deleted": "flash.childDeleted",
  "pastor-name-required": "pastor-name-required",
  "pastor-state-required": "pastor-state-required",
  "pastor-church-invalid": "pastor-church-invalid",
  "pastor-name-taken": "pastor-name-taken",
  "pastor-spouse-invalid": "pastor-spouse-invalid",
  "pastor-in-use": "pastor-in-use",
  "branding-saved": "flash.brandingSaved",
  "brand-photo-bad": "flash.brandPhotoBad",
  "brand-photo-large": "flash.brandPhotoLarge",
  "brand-name-long": "flash.brandNameLong",
  "user-created": "flash.userCreated",
  "user-updated": "flash.userUpdated",
  "role-created": "flash.roleCreated",
  "role-updated": "flash.roleUpdated",
  "role-deleted": "flash.roleDeleted",
  "role-in-use": "flash.roleInUse",
  "option-added": "flash.optionAdded",
  "option-updated": "flash.optionUpdated",
  "option-deleted": "flash.optionDeleted",
  "option-deactivated": "flash.optionDeactivated",
  "hh.memberAdded": "hh.memberAdded",
  "hh.attached": "hh.attached",
  "hh.created": "hh.created",
  "hh.updated": "hh.updated",
  "hh.deleted": "hh.deleted",
  "hh.detached": "hh.detached",
  "hh.noMember": "hh.noMember",
  "hh.alreadyMember": "hh.alreadyMember",
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
  "err-invalid": "flash.errInvalid",
  "err-used": "flash.errUsed",
  "bulk.updated": "flash.bulkUpdated",
  "bulk.deleted": "flash.bulkDeleted",
  "bulk.noSelection": "flash.bulkNoSelection",
  "bulk.noAction": "flash.bulkNoAction",
  "bulk.badDepartment": "flash.bulkBadDepartment",
  "bulk.badGroup": "flash.bulkBadGroup",
  "bulk-failed": "flash.bulkFailed",
  // Reports arrive as codes, not sentences, so a hand-typed ?err= value can
  // never be echoed back as an in-app message.
  "report-not-found": "rep.errNotFound",
  "report-locked": "rep.errEditReviewed",
  "report-body-required": "rep.errBody",
  "report-duplicate": "rep.dup",
  "report-note-required": "rep.errNote",
};

/** Message for a flash/err code, or the code itself when unknown. */
export function flashText(code: string | undefined | null, lang?: Lang): string | null {
  if (!code) return null;
  const t = getDict(normalizeLang(lang));
  const key = FLASH_KEYS[code];
  return key ? t(key) : code;
}

export function flashFromQuery(q: Record<string, string | undefined>, lang?: Lang): Flash {
  const t = getDict(normalizeLang(lang));
  // Only known codes reach the banner: the query string is user-controlled, so
  // an unrecognised value must render nothing rather than arbitrary text
  // inside the app's own chrome. A dictionary key counts as known (the admin
  // forms redirect with the key itself), and getDict echoes back keys it does
  // not have, which is what lets an invented value fall through to nothing.
  const one = (code: string): string | null => {
    const key = FLASH_KEYS[code];
    if (key) return t(key);
    const text = t(code);
    return text === code ? null : text;
  };
  const message = (code: string | undefined): string | null => {
    if (!code) return null;
    // A create/edit form can fail on several fields at once and then redirects
    // with the keys joined by commas; anything still unrecognised is dropped.
    const parts = code.split(",").map(one).filter((text): text is string => text !== null);
    return parts.length > 0 ? parts.join(" ") : null;
  };
  const ok = message(q.ok);
  if (ok) return { kind: "ok", text: ok };
  const err = message(q.err);
  if (err) return { kind: "err", text: err };
  return null;
}

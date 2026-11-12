import type { Flash } from "./views/layout";
import { getDict, normalizeLang, type Lang } from "./i18n";

/** Flash code (query param) -> i18n dictionary key. */
const FLASH_KEYS: Record<string, string> = {
  "member-created": "flash.memberCreated",
  "report-created": "flash.reportCreated",
  "report-reviewed": "flash.reportReviewed",
  "report-updated": "flash.reportUpdated",
  "report-unchanged": "flash.reportUnchanged",
  "member-updated": "flash.memberUpdated",
  "member-deleted": "flash.memberDeleted",
  "member-position": "flash.positionSaved",
  "church-leader-saved": "flash.churchLeaderSaved",
  "church-leader-cleared": "flash.churchLeaderCleared",
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
  "pastor-name-required": "pastor-name-required",
  "pastor-state-required": "pastor-state-required",
  "pastor-church-invalid": "pastor-church-invalid",
  "pastor-name-taken": "pastor-name-taken",
  "pastor-in-use": "pastor-in-use",
  "user-created": "flash.userCreated",
  "user-updated": "flash.userUpdated",
  "role-created": "flash.roleCreated",
  "role-updated": "flash.roleUpdated",
  "role-deleted": "flash.roleDeleted",
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
  "err-used": "flash.errUsed",
  "bulk.updated": "flash.bulkUpdated",
  "bulk.deleted": "flash.bulkDeleted",
  "bulk.noSelection": "flash.bulkNoSelection",
  "bulk.noAction": "flash.bulkNoAction",
  "bulk.badDepartment": "flash.bulkBadDepartment",
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
  const ok = q.ok;
  const err = q.err;
  if (ok && FLASH_KEYS[ok]) return { kind: "ok", text: t(FLASH_KEYS[ok]) };
  if (err && FLASH_KEYS[err]) return { kind: "err", text: t(FLASH_KEYS[err]) };
  if (err) return { kind: "err", text: err }; // fallback: literal message (escaped by JSX)
  return null;
}

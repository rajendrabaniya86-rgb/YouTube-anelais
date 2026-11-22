export function isCurrentScope(current, expected) {
  return Boolean(current && expected &&
    current.demo === false &&
    current.userId === expected.userId &&
    current.shopId === expected.shopId);
}

export function filterDraftsForScope(drafts, userId, shopId) {
  if (!userId || !shopId || !Array.isArray(drafts)) return [];
  return drafts.filter(draft => draft?.userId === userId && draft?.shopId === shopId);
}

export function shouldApplyInitialSession(authEventReceived) {
  return authEventReceived === false;
}

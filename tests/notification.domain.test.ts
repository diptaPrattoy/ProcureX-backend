import assert from "node:assert/strict";
import test from "node:test";
import { notificationReadFilter } from "../src/app/modules/notification/notification.domain.js";

test("notification read filter maps list modes to Prisma-compatible conditions", () => {
  assert.equal(notificationReadFilter("ALL"), undefined);
  assert.equal(notificationReadFilter("UNREAD"), null);
  assert.deepEqual(notificationReadFilter("READ"), { not: null });
});

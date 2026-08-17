/**
 * Self-check for the notification channel decision logic.
 * Run: node --import tsx scripts/check-notify.ts
 */

import assert from "node:assert";
import { deliveryOrder } from "../src/lib/notify.server";

assert.deepEqual(deliveryOrder("telegram", 123), ["telegram", "sms"], "linked + telegram pref");
assert.deepEqual(deliveryOrder("telegram", null), ["sms"], "unlinked falls back to sms");
assert.deepEqual(deliveryOrder("sms", 123), ["sms"], "sms pref skips telegram");
assert.deepEqual(deliveryOrder("sms", null), ["sms"], "sms pref, unlinked");
assert.deepEqual(deliveryOrder(null, 123), ["telegram", "sms"], "null pref defaults to telegram");

process.env.NOTIFICATION_DEFAULT_CHANNEL = "sms";
assert.deepEqual(deliveryOrder(null, 123), ["sms"], "env sms default overrides");
assert.deepEqual(
  deliveryOrder("telegram", 123),
  ["telegram", "sms"],
  "explicit pref beats env default",
);
delete process.env.NOTIFICATION_DEFAULT_CHANNEL;
assert.deepEqual(deliveryOrder(null, 123), ["telegram", "sms"], "unset env defaults to telegram");

console.log("notify checks passed");

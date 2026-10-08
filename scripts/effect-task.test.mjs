import assert from "node:assert/strict";
import test from "node:test";
import { scheduleEffectTask } from "../apps/web/src/lib/effect-task.ts";

const flush = () => new Promise(resolve => queueMicrotask(resolve));

test("effect work starts after setup and keeps cleanup for a started task", async () => {
  const events = [];
  const cancel = scheduleEffectTask(() => {
    events.push("start");
    return () => events.push("cleanup");
  });
  assert.deepEqual(events, []);
  await flush();
  assert.deepEqual(events, ["start"]);
  cancel();
  cancel();
  assert.deepEqual(events, ["start", "cleanup"]);
});

test("discarded effect setup never starts requests or allocates resources", async () => {
  let requests = 0;
  const cancel = scheduleEffectTask(() => { requests++; });
  cancel();
  await flush();
  assert.equal(requests, 0);
});

test("Strict Mode replay starts only the surviving effect and cleans it up", async () => {
  const events = [];
  const task = () => { events.push("request"); return () => events.push("abort"); };
  scheduleEffectTask(task)();
  const cancelCurrent = scheduleEffectTask(task);
  await flush();
  assert.deepEqual(events, ["request"]);
  cancelCurrent();
  assert.deepEqual(events, ["request", "abort"]);
});

test("dependency changes release previous resources and start the current task", async () => {
  const events = [];
  const cancelFirst = scheduleEffectTask(() => { events.push("first"); return () => events.push("release first"); });
  await flush();
  cancelFirst();
  const cancelSecond = scheduleEffectTask(() => { events.push("second"); return () => events.push("release second"); });
  await flush();
  assert.deepEqual(events, ["first", "release first", "second"]);
  cancelSecond();
  assert.deepEqual(events, ["first", "release first", "second", "release second"]);
});

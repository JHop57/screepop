import {assert} from "chai";
import {afterEach, beforeEach, describe, it} from "mocha";
import * as sinon from "sinon";

let WorkOrder: typeof import("../../src/jms/workOrder").WorkOrder;

describe("WorkOrder", () => {
  beforeEach(() => {
    // @ts-ignore : allow adding Game to global
    global.Game = {
      time: 100,
      getObjectById: sinon.stub()
    };
    globalThis.eval("var ERR_NOT_IN_RANGE = -9");
    delete require.cache[require.resolve("../../src/workOrder")];
    WorkOrder = require("../../src/workOrder").WorkOrder;
  });

  afterEach(() => {
    sinon.restore();
  });

  it("aborts after 50 ticks without execution", () => {
    const taskStack = {
      peek: () => undefined,
      pop: () => undefined,
      isEmpty: () => true
    } as any;

    const workOrder = new WorkOrder(taskStack);

    assert.equal(workOrder.status, "pending");

    global.Game.time = 151;

    assert.equal(workOrder.status, "aborted");
  });

  it("completes a harvest task and removes it from the stack", () => {
    const source = {};
    const harvest = sinon.stub().returns(0);
    const moveTo = sinon.stub();
    const peek = sinon.stub().returns({ step: "🔄", targetId: "source-1" });
    const pop = sinon.stub();
    const isEmpty = sinon.stub().returns(true);

    (global.Game.getObjectById as sinon.SinonStub).returns(source);

    const workOrder = new WorkOrder({ peek, pop, isEmpty } as any);
    workOrder.executeStep({ name: "creep-1", harvest, moveTo } as any);

    assert.equal(pop.calledOnce, true);
    assert.equal(harvest.calledOnceWith(source), true);
    assert.equal(moveTo.called, false);
    assert.equal(workOrder.status, "completed");
  });

  it("keeps a transfer task when the target is missing", () => {
    const log = sinon.stub(console, "log");
    const transfer = sinon.stub();
    const moveTo = sinon.stub();
    const peek = sinon.stub().returns({
      step: "📦",
      targetId: "structure-1",
      resourceType: "energy",
      amount: 10
    });
    const pop = sinon.stub();
    const isEmpty = sinon.stub().returns(false);

    (global.Game.getObjectById as sinon.SinonStub).returns(null);

    const workOrder = new WorkOrder({ peek, pop, isEmpty } as any);
    workOrder.executeStep({ name: "creep-2", transfer, moveTo } as any);

    assert.equal(pop.called, false);
    assert.equal(transfer.called, false);
    assert.equal(moveTo.called, false);
    assert.equal(log.calledOnce, true);
    assert.equal(workOrder.status, "pending");
  });

  it("moves toward a transfer target when out of range", () => {
    const target = {};
    const moveTo = sinon.stub();
    const transfer = sinon.stub().returns(-9);
    const peek = sinon.stub().returns({
      step: "📦",
      targetId: "structure-2",
      resourceType: "energy",
      amount: 25
    });
    const pop = sinon.stub();
    const isEmpty = sinon.stub().returns(false);

    (global.Game.getObjectById as sinon.SinonStub).returns(target);
    (global as any).ERR_NOT_IN_RANGE = -9;

    const workOrder = new WorkOrder({ peek, pop, isEmpty } as any);
    workOrder.executeStep({ name: "creep-3", transfer, moveTo } as any);

    assert.equal(transfer.calledOnceWith(target, "energy", 25), true, "Expected transfer to be called with correct arguments");
    assert.equal(moveTo.calledOnceWith(target), true, "Expected moveTo to be called with the target");
    assert.equal(pop.called, false, "Expected pop not to be called since the task is not completed");
    assert.equal(workOrder.status, "pending", "Expected work order to remain pending since the task is not completed");
  });
});

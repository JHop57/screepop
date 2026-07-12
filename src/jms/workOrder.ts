import {WorkOrder, Task, Steps, OrderStatus, OrderType} from './types'

// A utility function to bundle independent tasks into an array
const bundleTasks = (...tasks: Task[]): Task[] => tasks;

// Takes an array of tasks and wraps them inside a fresh WorkOrder
const createWorkOrder = (OrderType: OrderType, repeat: number) => (tasks: Task[]): WorkOrder => ({
    id: Math.floor(Math.random() * 65534),
    type: OrderType,
    targetId: (tasks[tasks.length - 1]).targetId,
    status: OrderStatus.Pending,
    tasks: tasks,
    repeat: repeat,
    birthTime: Game.time,
    heartbeatTime: Game.time
});

export function upgradeController(id: Id<StructureController>, sourceId: Id<Source>, amount: number):WorkOrder {
    return pipe(
        bundleTasks(
            { step: Steps.Harvest, targetId: sourceId, resourceType: RESOURCE_ENERGY, amount: amount },
            { step: Steps.Upgrade, targetId: id }
        ),
        createWorkOrder(OrderType.UPGRADE_CONTROLLER, 999)
    );
}

export function buildSite(id: Id<ConstructionSite>, sourceId: Id<Source>, amount: number):WorkOrder {
    return pipe(
        bundleTasks(
            { step: Steps.Harvest, targetId: sourceId, resourceType: RESOURCE_ENERGY, amount: amount },
            { step: Steps.Build, targetId: id }
        ),
        createWorkOrder(OrderType.BUILD_SITE, 1)
    );
}

export function fillSpawn(id: Id<StructureSpawn>, sourceId: Id<Source>, amount: number):WorkOrder {
    return pipe(
        bundleTasks(
            { step: Steps.Harvest, targetId: sourceId, resourceType: RESOURCE_ENERGY, amount: amount },
            { step: Steps.Transfer, targetId: id, resourceType: RESOURCE_ENERGY, amount: amount }
        ),
        createWorkOrder(OrderType.FILL_SPAWN, 1)
    );
}

export function fillExtension(id: Id<StructureExtension>, sourceId: Id<Source>, amount: number):WorkOrder {
    return pipe(
        bundleTasks(
            { step: Steps.Harvest, targetId: sourceId, resourceType: RESOURCE_ENERGY, amount: amount },
            { step: Steps.Transfer, targetId: id, resourceType: RESOURCE_ENERGY, amount: amount }
        ),
        createWorkOrder(OrderType.FILL_EXTENSION, 1)
    );
}

export function fillContainer(id: Id<StructureContainer>, sourceId: Id<Source>, amount: number):WorkOrder {
    return pipe(
        bundleTasks(
            { step: Steps.Harvest, targetId: sourceId, resourceType: RESOURCE_ENERGY, amount: amount },
            { step: Steps.Transfer, targetId: id, resourceType: RESOURCE_ENERGY, amount: amount }
        ),
        createWorkOrder(OrderType.FILL_CONTAINER, 1)
    );
}

// // Overloads handle type inference through the chain step-by-step
function pipe<A>(a: A): A;
function pipe<A, B>(a: A, ab: (x: A) => B): B;
function pipe<A, B, C>(a: A, ab: (x: A) => B, bc: (x: B) => C): C;
function pipe<A, B, C, D>(a: A, ab: (x: A) => B, bc: (x: B) => C, cd: (x: C) => D): D;

// Root execution logic
function pipe(value: any, ...fns: Function[]): any {
  return fns.reduce((acc, fn) => fn(acc), value);
}

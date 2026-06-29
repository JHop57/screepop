import { create } from 'lodash';
import {WorkOrder, Task, Steps} from './types'

// A utility function to bundle independent tasks into an array
const bundleTasks = (...tasks: Task[]): Task[] => tasks;

// Takes an array of tasks and wraps them inside a fresh WorkOrder
const createWorkOrder = (tasks: Task[]): WorkOrder => ({
    id: Math.floor(Math.random() * 65534),
    birthTime: Game.time,
    heartbeatTime: Game.time,
    status: "pending",
    tasks: tasks
});


// Example: Create a chained pipeline that creates an explicit multi-task WorkOrder
export function moveAndHarvest(sourceId: Id<Source>, amount: number, containerId: Id<StructureContainer>): WorkOrder {
    return pipe(
        bundleTasks(
            { step: Steps.Move, targetId: containerId }, // Task 1: Go to container
            { step: Steps.Harvest, targetId: sourceId, resourceType: RESOURCE_ENERGY, amount } // Task 2: Harvest
        ),
        createWorkOrder // Wraps the array of 2 tasks into 1 WorkOrder
    );
}

export function upgradeController(id: Id<StructureController>, sourceId: Id<Source>, amount: number):WorkOrder {
    return pipe(
        bundleTasks(
            { step: Steps.Harvest, targetId: sourceId, resourceType: RESOURCE_ENERGY, amount: amount},
            {step: Steps.Upgrade, targetId: id}
        ),
        createWorkOrder
    );
}

export function buildSite(id: Id<ConstructionSite>, sourceId: Id<Source>, amount: number):WorkOrder {
    return pipe(
        bundleTasks(
            { step: Steps.Harvest, targetId: sourceId, resourceType: RESOURCE_ENERGY, amount: amount},
            {step: Steps.Build, targetId: id}
        ),
        createWorkOrder
    );
}

export function harvestEnergy(id: Id<Source>, amount: number):WorkOrder {
    return pipe(
        bundleTasks(
            {step: Steps.Harvest, targetId: id, resourceType: RESOURCE_ENERGY, amount: amount}
        ),
        createWorkOrder
    );
}

export function transferEnergy(id: Id<Structure>, amount: number):WorkOrder {
    return pipe(
        bundleTasks({
            step: Steps.Transfer, targetId: id, resourceType: RESOURCE_ENERGY, amount: amount}
        ),
        createWorkOrder
    );
}

// export function harvestEnergy(id: Id<Source>, amount: number):WorkOrder {
//     const step:Task = {
//         step: Steps.Harvest,
//         targetId: id,
//         resourceType: RESOURCE_ENERGY,
//         amount: amount
//     };
//     const wo:WorkOrder = {
//         id: Math.floor(Math.random() * 65534),
//         birthTime: Game.time,
//         status: "pending",
//         tasks: [step]
//     };
//     return wo;
// }
// export function transferEnergy(id: Id<Structure>, amount: number):WorkOrder {
//     const step:Task = {
//         step: Steps.Transfer,
//         targetId: id,
//         resourceType: RESOURCE_ENERGY,
//         amount: amount
//     };
//     const wo:WorkOrder = {
//         id: Math.floor(Math.random() * 65534),
//         birthTime: Game.time,
//         status: "pending",
//         tasks: [step]
//     };
//     return wo;
// }

// export function upgradeController(id: Id<StructureController>):WorkOrder {
//     const step:Task = {
//         step: Steps.Upgrade,
//         targetId: id
//     };
//     const wo:WorkOrder = {
//         id: Math.floor(Math.random() * 65534),
//         birthTime: Game.time,
//         status: "pending",
//         tasks: [step]
//     };
//     return wo;
// }
// export function newWorkOrder(woTasks:Task[]): WorkOrder {
//     return {
//         id: Math.floor(Math.random() * 65534),
//         birthTime: Game.time,
//         status: "pending",
//         tasks: woTasks
//     };
// }
// export function newTask(step: Steps, target: TaskTarget): Task {
//     return {
//         step: step,
//         targetId: target
//     };
// }


// // Overloads handle type inference through the chain step-by-step
function pipe<A>(a: A): A;
function pipe<A, B>(a: A, ab: (x: A) => B): B;
function pipe<A, B, C>(a: A, ab: (x: A) => B, bc: (x: B) => C): C;
function pipe<A, B, C, D>(a: A, ab: (x: A) => B, bc: (x: B) => C, cd: (x: C) => D): D;

// Root execution logic
function pipe(value: any, ...fns: Function[]): any {
  return fns.reduce((acc, fn) => fn(acc), value);
}

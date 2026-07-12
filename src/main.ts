//import { ErrorMapper } from "utils/ErrorMapper"
import * as _ from "lodash";
//import * as roleHarvester from "roleHarvester";
// import * as roleUpgrader from 'roleUpgrader'
// import * as roleBuilder from 'roleBuilder'
import {jms,WorkOrder,Task, Steps } from "./jms/jobManagementSystem";
import Hud from "utils/Hud";
//import {WorkOrder, Steps, Task, newWorkOrder } from "./jms/workOrder";
//import { Stack } from "./utils/stack";

declare global {
    /*
    Example types, expand on these or remove them and add your own.
    Note: Values, properties defined here do no fully *exist* by this type definition alone.
          You must also give them an implementation if you would like to use them. (ex. actually setting a `role` property in a Creeps memory)

    Types added in this `global` block are in an ambient, global context. This is needed because `main.ts` is a module file (uses import or export).
    Interfaces matching on name from @types/screeps will be merged. This is how you can extend the 'built-in' interfaces from @types/screeps.
  */
    // Memory extension samples
    interface Memory {
        uuid: number;
        log: any;
        role: string;
        highPriorityWorkOrders: WorkOrder[];
        mediumPriorityWorkOrders: WorkOrder[];
    }

    interface CreepMemory {
        role: string;
        workOrderId?: number;
        workOrderStep?: number;
        workOrderTargetId?: Id<Source | Structure | ConstructionSite | StructureController | StructureSpawn | StructureExtension | StructureContainer>;
    }
}
// Syntax for adding properties to `global` (ex "global.log")
declare const global: {
    log: any;
};

let log = Memory.log || [];
jms.highPriorityWorkOrders = Memory.highPriorityWorkOrders || [];
jms.mediumPriorityWorkOrders = Memory.mediumPriorityWorkOrders || [];

console.log(`game reloaded`);

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
//export const loop = ErrorMapper.wrapLoop(() => {
export const loop = () => {
    const ownedRoom = Object.values(Game.rooms)
        .find(room => room.controller?.my);
    if(ownedRoom) {
        jms.initializeWorkorders(ownedRoom);
    }

    let harvesterCount: number = 0;
    let builderCount: number = 0;
    let upgraderCount: number = 0;

    for (const name in Game.creeps) {
        const creep = Game.creeps[name];

        if(creep.memory.role === "harvester") {
            harvesterCount++;
        }
        if(creep.memory.role === "builder"){
            builderCount++;
        }
        if(creep.memory.role === "upgrader"){
            upgraderCount++;
        }

        jms.assignWorkOrder(creep);
        jms.executeStep(creep);
    }


    if (harvesterCount < 3) {
        let newName = "Harvester" + Game.time;
        console.log("Spawning new harvester: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: "harvester" } });
    }

    if (builderCount < 3) {
        let newName = "Builder" + Game.time;
        console.log("Spawning new builder: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: "builder" } });
    }

    // let upgrader = _.filter(Game.creeps, (creep: Creep) => creep.memory.role == "upgrader");
    // console.log("Upgraders: " + upgrader.length);

    if (upgraderCount < 3) {
        let newName = "Upgrader" + Game.time;
        console.log("Spawning new upgrader: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: "upgrader" } });
    }

    if (Game.spawns["Spawn1"].spawning) {
        var spawningCreep = Game.creeps[Game.spawns["Spawn1"].spawning.name];
        Game.spawns["Spawn1"].room.visual.text(
            "🛠️" + spawningCreep.memory.role,
            Game.spawns["Spawn1"].pos.x + 1,
            Game.spawns["Spawn1"].pos.y,
            { align: "left", opacity: 0.8 }
        );
    }


    var hud = new Hud();
    hud.makeElement("WorkOrders", {x: 10, y: 10, roomName: ownedRoom!.name}, [
            `High Priority Work Orders: ${jms.highPriorityWorkOrders.length}`,
            `Medium Priority Work Orders: ${jms.mediumPriorityWorkOrders.length}`
        ], undefined, {scale: "medium"});
    hud.display();  // and clear the hudElements array for the next tick

    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
            delete Memory.creeps[name];
        }
    }
    //if (Game.time % 10 == 0) {
        jms.CleanUpWorkOrders();

        Memory.log = log;
        Memory.mediumPriorityWorkOrders = jms.mediumPriorityWorkOrders;
        Memory.highPriorityWorkOrders = jms.highPriorityWorkOrders;
    //}
};

global.log = (...args: any[]) => console.log("LOG:", ...args);



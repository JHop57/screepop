import {WorkOrder, Task, Steps, OrderStatus, OrderClass} from './types'
import * as WO from "./workOrder";

const Plan = {
    SPAWN: 1,
    CONTROLLER: 4,
    STRUCTURE_EXTENSION:2,
    CONSTRUCTION: 3
};

class Jms {
    /*scribbles: Critical,high,medium,low*/
    public highPriorityWorkOrders: WorkOrder[] = [];
    public mediumPriorityWorkOrders: WorkOrder[] = [];

    constructor(){}

    public addWorkOrder(wo:WorkOrder, priority?: 'high' | 'medium'):void {
        if (priority === 'high') {
            this.highPriorityWorkOrders.push(wo);
        } else {
            this.mediumPriorityWorkOrders.push(wo);
        }
    }

    private findWorkOrderById(id: number | undefined): WorkOrder | undefined {
        return id !== undefined ? this.highPriorityWorkOrders.find(wo => wo.id === id) || this.mediumPriorityWorkOrders.find(wo => wo.id === id) : undefined;
    }

    public initializeWorkorders(room: Room):void {
        let controllerCount = this.mediumPriorityWorkOrders.filter(wo => wo.class === OrderClass.STRUCTURE_CONTROLLER).length;
        let constructionCount = this.mediumPriorityWorkOrders.filter(wo => wo.class === OrderClass.MAX_CONSTRUCTION_SITES).length;
        let spawnCount = this.highPriorityWorkOrders.filter(wo => wo.class === OrderClass.STRUCTURE_SPAWN).length;
        if(controllerCount < Plan.CONTROLLER){
            this.AddUpgradeControllerJob(room);
        }
        if(constructionCount < Plan.CONSTRUCTION){
            // eventually replace with something to create a wo when a site is created
            var sites: ConstructionSite[] = room.find(FIND_MY_CONSTRUCTION_SITES);
            if (sites.length > 0) {
                this.AddBuildConstructionJob(room, sites);
            }
        }

        if(spawnCount < Plan.SPAWN){
            this.AddSpawnJob(room);
        }
    }

    public assignWorkOrder(creep: Creep):void{
        const wo = this.findWorkOrderById(creep.memory.workOrderId);
        if(wo !== undefined){
            return;
        }

        var job = this.highPriorityWorkOrders.find(WorkOrder => WorkOrder.status === OrderStatus.Pending) || this.mediumPriorityWorkOrders.find(WorkOrder => WorkOrder.status === OrderStatus.Pending);
        if(job === undefined){
            console.log(`${creep.name}:assignWorkOrder:no workOrder`);
            return;
        }
        creep.memory.workOrderId = job.id;
        creep.memory.workOrderStep = 0;
        job.status = OrderStatus.InProgress;
    }

    private AddUpgradeControllerJob(room: Room):void {
        var controller = room.controller;
        if (!controller) {
            console.log(`Controller not found in the room ${room.name}.`);
            return;
        }
        var src = controller.pos.findClosestByPath(FIND_SOURCES);
        if (!src) {
            console.log(`No source found in the room ${room.name}.`);
            return;
        }
        var job = WO.upgradeController(controller.id, src.id, CARRY_CAPACITY);
        this.addWorkOrder(job);
    }

    private AddBuildConstructionJob(room: Room, sites: ConstructionSite[]):void {
        if (sites.length === 0) {
            console.log(`No construction sites found in the room ${room.name}.`);
            return;
        }
        var site = sites[0]; // For simplicity, just take the first site. You might want to implement a better selection strategy.
        if (!site) {
            console.log(`Construction site not found in the room ${room.name}.`);
            return;
        }
        var src = site.pos.findClosestByPath(FIND_SOURCES);
        if (!src) {
            console.log(`No source found in the room ${room.name}.`);
            return;
        }
        var job = WO.buildSite(site.id, src.id, CARRY_CAPACITY);
        this.addWorkOrder(job);
    }

    private AddSpawnJob(room: Room):void {
        var spawns: StructureSpawn[] = room.find(FIND_MY_SPAWNS);
        if (spawns.length > 0) {
            var spawn = spawns[0];
            if(spawn.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                console.log(`Spawn ${spawn.name} is already full. No need to add a fill spawn job.`);
                return;
            }
            var src = spawn.pos.findClosestByPath(FIND_SOURCES);
            if (src) {
                var job = WO.fillSpawn(src.id, CARRY_CAPACITY);
                this.addWorkOrder(job, 'high');
                console.log(`Added fill spawn job for spawn ${spawn.name} in room ${room.name}.`);
            }
        }
    }

// // Example: Find all extensions in a specific room that have free energy capacity
// const extensions = Game.rooms['W1S1'].find(FIND_MY_STRUCTURES, {
//   filter: (structure) => {
//     return structure.structureType === STRUCTURE_EXTENSION &&
//            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
//   }
// });


    private executeHarvest(creep: Creep, task: Task): boolean {
        const source = Game.getObjectById(task.targetId) as Source | null;
        if (!source) {
            console.log(`${creep.name}:executeHarvest:Source with ID ${task.targetId} not found.`);
            return true;// return success so step is not repeated
        }

        const result = creep.harvest(source);

        if (result == ERR_NOT_IN_RANGE) {
            creep.moveTo(source);
            return false; // not there yet
        }

        if(result === OK && creep.store.getFreeCapacity() > 0)
            return false;  // keep loading

        //console.log(`${creep.name}:executeHarvest:Target=${task.targetId}:Error=${result}.`);
        return true;  // some other error: quit here
    }

    private executeTransfer(creep: Creep, task: Task): boolean {
        const target = Game.getObjectById(task.targetId) as Structure | null;
        if (!target) {
            console.log(`${creep.name}:executeTransfer:Target with ID ${task.targetId} not found.`);
            return true;// return success so step is not repeated
        }
        if (!task.resourceType || !task.amount) {
            console.log(`${creep.name}:executeTransfer:Invalid transfer task: missing resourceType or amount.`);
            return true;// return success so step is not repeated
        }

        const result = creep.transfer(target, task.resourceType, task.amount);
        if (result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
            return false; // not there yet
        }
        if(result === OK && creep.store.getUsedCapacity() > 0)
            return false;  // task incomplete

        console.log(`${creep.name}:executeTransfer:Target=${task.targetId}:Error=${result}`);
        return true; // return success so that work order is completed.
    }

    private executeBuild(creep: Creep, task: Task): boolean {
        const target = Game.getObjectById(task.targetId) as ConstructionSite | null;
        if (!target) {
            console.log(`${creep.name}:executeBuild:Target with ID ${task.targetId} not found for creep ${creep.name}`);
            return true;// return success so step is not repeated
        }

        const result = creep.build(target);
        if (result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
            return false; // not there yet
        }
        if(result === OK && creep.store.getUsedCapacity() > 0)
            return false;  // task incomplete

        console.log(`${creep.name}:executeBuild:Target=${task.targetId}:Error=${result}`);
        return true; // task error so toss the task
    }

    private executeUpgrade(creep: Creep, task: Task): boolean {
        const target = Game.getObjectById(task.targetId) as StructureController | null;
        if (!target) {
            console.log(`${creep.name}:executeUpgrade:Target with ID ${task.targetId} not found for creep ${creep.name}`);
            return true;// return success so step is not repeated
        }

        const result = creep.upgradeController(target);
        if (result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
            return false; // not there yet
        }
        if(result === OK && creep.store.getUsedCapacity() > 0)
            return false;  // task incomplete

        console.log(`${creep.name}:executeUpgrade:Target=${task.targetId}:Error=${result}`);
        return true; // task error so toss the task
    }

    public executeStep(creep: Creep): void {
        const wo = this.findWorkOrderById(creep.memory.workOrderId);
        if(wo === undefined){
            console.log(`${creep.name}:executeStep:no workOrder to execute`);
            return;
        }

        if(wo.status === OrderStatus.Pending)
            wo.status = OrderStatus.InProgress;

        let StepId =  creep.memory.workOrderStep;
        if(StepId === undefined)
            StepId = 0;
        const currentTask = wo.tasks[StepId];

        let done: boolean = false;
        switch (currentTask.step) {
            case Steps.Harvest:
                if(this.executeHarvest(creep, currentTask) === true) {
                    done = true;
                }
                break;
            case Steps.Transfer:
                if(this.executeTransfer(creep, currentTask) === true) {
                    done = true;
                }
                break;
            case Steps.Build:
                if(this.executeBuild(creep, currentTask) === true) {
                    done = true;
                }
                break;
            case Steps.Upgrade:
                if(this.executeUpgrade(creep, currentTask) === true) {
                    done = true;
                }
                break;
        }

        if (done) {
            StepId = StepId + 1;

            if(wo.tasks.length <= StepId){
                wo.status = "completed";
                creep.memory.workOrderId = undefined;
                creep.memory.workOrderStep = undefined;
                console.log(`${creep.name}:executeStep: WorkOrder ${wo.id} completed.`);
                return;
            }

            creep.memory.workOrderStep = StepId;
        }

        wo.heartbeatTime = Game.time;
    }

    public CleanUpWorkOrders(): void {
        this.highPriorityWorkOrders.forEach(element => {
            if(element.status === OrderStatus.InProgress && Game.time - element.heartbeatTime > 20) {
                element.status = OrderStatus.Completed;
            }
        });
        this.mediumPriorityWorkOrders.forEach(element => {
            if(element.status === OrderStatus.InProgress && Game.time - element.heartbeatTime > 20) {
                element.status = OrderStatus.Completed;
            }
        });
        this.highPriorityWorkOrders = this.highPriorityWorkOrders.filter(x => x.status != OrderStatus.Completed && x.status != OrderStatus.Aborted);
        this.mediumPriorityWorkOrders = this.mediumPriorityWorkOrders.filter(x => x.status != OrderStatus.Completed && x.status != OrderStatus.Aborted);
    }
}

const jms = new Jms();
export {jms, WO, WorkOrder, Steps, Task, OrderStatus};

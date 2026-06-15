/* eslint-disable @typescript-eslint/prefer-for-of */
/* eslint-disable no-underscore-dangle */
/* eslint-disable max-classes-per-file */
import { Job, JobBoard, MY_NUMS } from "JobBoard";
import { Evaluation, Task, econTasks } from "econTasks";
import { Tools } from "utils/Tools";

interface Dwarf {
  readonly id: Id<Creep>;
  readonly role: string;
  commands: Command[];
  info: {
    remove: boolean;
    workParts: number;
    carryParts: number;
    spawnCost: number;
    cargo: SimpleStore;
    working: boolean;
  };
}
interface Command {
  readonly type: string;
  target: Id<AnyStructure | ConstructionSite | Creep | Source | Mineral | Resource | Tombstone | Ruin>;
  pos: Pos;
  amount: number;
  readonly jobId?: number;
  readonly resourceType?: ResourceConstant;
}
interface resourcePlan {
    visits: {roomName: string, id: Id<AnyStoreStructure>, amount: number}[];
    available: number;
    planUse: number;
    resourceType: ResourceConstant;
}

class CreepHandler {
    private foremen: Foreman[] = [];

    public registerForeman(newguy: Foreman) {
        this.foremen.push(newguy);
    }
    public run() {
        for (const foreman of this.foremen) {
            foreman.run();
        }
    }
    public assignCreep(creep: Creep): boolean {
        const nameparts = creep.name.split("-");
        const role = nameparts[nameparts.length - 1];
        for (const foreman of this.foremen) {
            if (foreman.memberTypes.includes(role)) {
                if(foreman.memberIDs.includes(creep.id)) return true;
                if (foreman.assignCreep(creep, role)) return true;
            }
        }
        return false;
    }
    public getUpdateFunctions(): {func:() => number, name: string}[] {
        return this.foremen.map(foreman => ({func: () => foreman.updateJobs(), name: foreman.name}));
    }
}

abstract class Foreman {
    protected dwarves: Dwarf[] = [];
    protected _memberTypes: { [key: string]: string } = {};
    protected abstract jobs: Job[];
    // protects name during rollup, for Prioritizer purposes.
    protected abstract foremanName: string;

    public get memberTypes(): string[] {
        return Object.keys(this._memberTypes);
    }
    public get memberIDs(): Id<Creep>[] {
        return this.dwarves.map(dwarf => dwarf.id);
    }
    public get name(): string {
        return this.foremanName;
    }
    public abstract run(): void;
    public abstract assignCreep(creep: Creep, role: string): boolean;
    public abstract updateJobs():number;
}


class EconWorkForeman extends Foreman {
    protected jobs: Job[];
    protected foremanName = "econWorkForeman";
    public constructor() {
        super();
        this._memberTypes = {
            "w": "worker",
            "md": "mobileDelver",
        };
        this.jobs = [];
    }
    // must be of shape [dwarfs][jobs], order matters!!
    // only semi-normalizes, mostly made to account for other dwarfs' priorities when deciding on job allocation.
    private normalizeTaskMatrix(taskMatrix: Evaluation[][]) {
        // normalize, order matters!
        const skipNormalization = taskMatrix.length === 1;
        if(skipNormalization){
            for(const task of taskMatrix[0]){
                task.normalized = task.score;
            }
            return;
        }

        for(let j = 0; j < taskMatrix[0].length; j++) {
            const sum = _.sum(taskMatrix.map(row => row[j].score));
            if(sum === 0) {
                for(let i = 0; i < taskMatrix.length; i++){
                    taskMatrix[i][j].normalized = 0;
                }
                continue;
            }
            for(let i = 0; i < taskMatrix.length; i++){
                taskMatrix[i][j].normalized = taskMatrix[i][j].score / sum;
            }
        }
        for(let i = 0; i < taskMatrix.length; i++){
            const sum = _.sum(taskMatrix[i].map(cell => cell.normalized));
            if(sum === 0) {
                for(let j = 0; j < taskMatrix[0].length; j++){
                    taskMatrix[i][j].normalized = 0;
                }
                continue;
            }
            for(let j = 0; j < taskMatrix[0].length; j++){
                taskMatrix[i][j].normalized = taskMatrix[i][j].normalized / sum;
            }
        }
    }
    private findBestTaskCoords(taskMatrix: Evaluation[][]): {i: number, j: number} {
        const dwarfLength = taskMatrix.length;
        const jobLength = taskMatrix[0].length;
        if(dwarfLength === 0 || jobLength === 0) return {i: -1, j: -1};
        let best = {i: -1, j: -1, score: 0};
        for(let i = 0; i < dwarfLength; i++){
            for(let j = 0; j < jobLength; j++){
                if(taskMatrix[i][j].normalized > best.score){
                    best = {i, j, score: taskMatrix[i][j].normalized};
                }
            }
        }
        return {i: best.i, j: best.j};
    }
    private findNearestContainers(
        pos: Pos,
        amount?: number,
        maxRank?: number,
        resourceType?: ResourceConstant
    ): {roomName: string, id: Id<AnyStoreStructure>}[] {
        // function draft courtesy of Claude ai.
        let results: {roomName: string, id: Id<AnyStoreStructure>, distance: number, stored: number}[] = [];

        const roomQueue: string[] = [pos.roomName];
        const checkedRooms = new Set<string>();

        while(roomQueue.length > 0) {
            const roomId = roomQueue.shift()!;
            if(checkedRooms.has(roomId)) continue;
            checkedRooms.add(roomId);

            const roomAtlas = g.atlas.rooms[roomId];
            if(!roomAtlas) continue;

            // find closest container in this room to check abort condition
            let closestInRoom = Infinity;
            for(const containerId in roomAtlas.containers) {
                const container = roomAtlas.containers[containerId as Id<AnyStoreStructure>];
                const dist = Tools.maxDistance(pos, container.pos);
                if(dist < closestInRoom) closestInRoom = dist;
            }

            // if results has anything, check abort condition
            if(results.length > 0) {
                const worstDistance = results[results.length - 1].distance;
                if(closestInRoom > worstDistance + 50) {
                    // don't expand neighbors, but don't skip queue
                    continue;
                }
            }

            for(const containerId in roomAtlas.containers) {
                const container = roomAtlas.containers[containerId as Id<AnyStoreStructure>];

                if(maxRank !== undefined && container.rank > maxRank) continue;

                let available: number;
                if(resourceType) {
                    available = container.store[resourceType] || 0;
                } else {
                    available = _.max(Object.values(container.store));
                }
                if(available <= 0) continue;

                const distance = Tools.maxDistance(pos, container.pos);

                results.push({roomName: roomId, id: containerId as Id<AnyStoreStructure>, distance, stored: available});

            }
            results.sort((a, b) => a.distance - b.distance);
            results = results.slice(0, 5);

            if(amount && _.sum(results.map(r => r.stored)) >= amount && results.length >= 5) return results.map(({roomName, id}) => ({roomName, id}));

            for(const neighbor of roomAtlas.neighbors || []) {
                if(!checkedRooms.has(neighbor)) roomQueue.push(neighbor);
            }
        }

        return results.map(({roomName, id}) => ({roomName, id}));
    }
    private findBestTaskForJob(job: Job, simDwarf: Dwarf, simStore: {store:SimpleStore, used: number}, simPos:Pos, resourcePlanMatrix: (resourcePlan|undefined)[][], matrixCoords: {i: number, j: number}): Evaluation {
        let best = econTasks[job.type].efficiency(simDwarf, simStore.store, simPos, job);

        if(job.type === "delve") return best

        let rank = MY_NUMS.END_USER_RANK
        if(job.type === "deliver") rank = job.rank

        const availableCarry = simDwarf.info.carryParts*50 - simStore.used - _.sum(simStore.store);
        let resourcePlan = resourcePlanMatrix[matrixCoords.i][matrixCoords.j]

        // if already planned, or planned wrong resource, or plan fully used, or creep full; return original evaluation, don't mess with it.
        const idealAmount = Math.min(availableCarry - (resourcePlan?.planUse || 0), econTasks[job.type].maxResource(job));
        if(idealAmount <= 0) return best

        const roomList = [job.pos.roomName];
        const checkedRooms = new Set<string>();
        if (simPos.roomName !== job.pos.roomName) {
            roomList.push(simPos.roomName);
        }
        let plan: resourcePlan = {visits: [], available: availableCarry, planUse: 0, resourceType: job.resourceType as ResourceConstant}
        let i = 0
        while(roomList.length > 0 && idealAmount > 0 && Game.cpu.bucket > 20) {
            i++
            const roomName = roomList.shift() || "";
            if(!g.atlas.rooms[roomName]) continue;
            for(const containerId in g.atlas.rooms[roomName].containers){
                const container = g.atlas.rooms[roomName].containers[containerId as Id<AnyStoreStructure>];
                let resourceType = job.resourceType
                if(resourceType === "any" && resourcePlan){
                    resourceType = resourcePlan.resourceType;
                }
                if(resourceType === "any"){
                    for(const type in simStore.store){
                        if((simStore.store[type as ResourceConstant]||0) > 0){
                            resourceType = type as ResourceConstant;
                            break;
                        }
                    }
                }
                if(resourceType === "any"){
                    let max=0;
                    let bestType: ResourceConstant | undefined;
                    for(const type in container.store){
                        if((container.store[type as ResourceConstant] || 0) > max){
                            max = container.store[type as ResourceConstant] || 0;
                            bestType = type as ResourceConstant;
                        }
                    }
                    if(!bestType) continue;
                    resourceType = bestType;
                }

                if(!container.store[resourceType] || container.rank >= rank || !resourceType) {
                    continue;
                }
                const actualAmount = Math.min(idealAmount, container.store[resourceType] || 0);
                const containerPos = container.pos;
                const timeAdjustment = Tools.maxDistance(simPos, containerPos);
                simStore.store[resourceType] = actualAmount + (simStore.store[resourceType] || 0);
                const test = econTasks[job.type].efficiency(simDwarf, simStore.store, containerPos, job, timeAdjustment);
                simStore.store[resourceType]! -= actualAmount;
                if(test.score > best.score){
                    best = test;
                    plan = {visits: [{roomName, id: containerId as Id<AnyStoreStructure>, amount: actualAmount}], available: actualAmount, planUse: 0, resourceType};
                }
            }
            checkedRooms.add(roomName);
            if(best.time < 20 || i > 20) break;
            for(const neighbor of g.atlas.rooms[roomName].neighbors){
                if(checkedRooms.has(neighbor) || !g.atlas.rooms[neighbor]){
                    continue;
                }
                roomList.push(neighbor);
            }
        }
        if(!resourcePlan){
            resourcePlan = {visits: [], available: (simStore.store[plan.resourceType]||0), planUse: 0, resourceType: plan.resourceType}
        }
        resourcePlan.visits.push(...plan.visits)
        resourcePlan.available += plan.available;
        resourcePlanMatrix[matrixCoords.i][matrixCoords.j] = resourcePlan;
        return best;
    }
    private assignDelveTasks() {
        // delve tasks, no worry about picking up resources.
        const taskMatrix: Evaluation[][] = [];
        const jobOptions = this.jobs.filter(job => job.type === "delve" && job.active < job.amount);
        // only assign new delvers, don't bother old ones.
        // delver jobs should be considered permanent.
        const dwarfOptions = this.dwarves.filter(dwarf => dwarf.role === "mobileDelver" && !dwarf.info.remove && !dwarf.commands[0]);
        for (let i = 0; i < dwarfOptions.length; i++) {
            const dwarf = dwarfOptions[i];
            const creep = Game.getObjectById(dwarf.id);
            if (!creep) {
                dwarf.info.remove = true;
                console.log("creep not found for econ foreman delve task update, removing dwarf");
                return;
            }
            taskMatrix[i] = taskMatrix[i] || [];
            for (let j = 0; j < jobOptions.length; j++) {
                const simDwarf = dwarfOptions[i];
                const simPos = creep.pos;
                taskMatrix[i][j] = econTasks[jobOptions[j].type].efficiency(simDwarf, {}, simPos, jobOptions[j]);
            }
        }
        // condition is just a check before starting the loop
        while((dwarfOptions.length !== 0 && jobOptions.length !== 0)){
            this.normalizeTaskMatrix(taskMatrix);

            // pick best task.
            const best = this.findBestTaskCoords(taskMatrix);
            if(best.i === -1 || best.j === -1) break;

            const chosenDwarf = dwarfOptions[best.i];
            const chosenJob = jobOptions[best.j];
            econTasks[chosenJob.type].claim(chosenDwarf, Game.getObjectById(chosenDwarf.id) as Creep, chosenJob, taskMatrix[best.i][best.j].amount);
            // remove select dwarf so they don't get picked again.
            taskMatrix.splice(best.i, 1);
            dwarfOptions.splice(best.i, 1);
            // recalculate that job
            for(let i = 0; i < dwarfOptions.length; i++){
                const simDwarf = dwarfOptions[i];
                const simStore = simDwarf.info.cargo;
                const simPos = Game.getObjectById(simDwarf.id)!.pos
                taskMatrix[i][best.j] = econTasks[chosenJob.type].efficiency(simDwarf, simStore, simPos, chosenJob);
            }
        }
    }
    private assignWorkerTasks() {
        const taskMatrix: Evaluation[][] = [];
        const jobOptions = this.jobs.filter(job => job.amount > 0);
        const dwarfOptions = this.dwarves.filter(dwarf => !dwarf.info.remove && !dwarf.commands[0]);
        const simStores: {store:SimpleStore, used: number}[] = [];
        const simPos: Pos[] = [];
        // list per cell in taskMatrix
        const plannedSources: (resourcePlan|undefined)[][] = [];
        for (let i = 0; i < dwarfOptions.length; i++) {
            const dwarf = dwarfOptions[i];
            const creep = Game.getObjectById(dwarf.id);
            if (!creep) {
                dwarf.info.remove = true;
                console.log("creep not found for econ foreman task update (non-delve), removing dwarf");
                return;
            }
            const simDwarf = dwarfOptions[i];
            simStores[i] = {store: simDwarf.info.cargo, used: 0};
            taskMatrix[i] = taskMatrix[i] || [];
            plannedSources[i] = plannedSources[i] || [];
            for (let j = 0; j < jobOptions.length; j++) {
                simPos[i] = creep.pos
                // plannedSources[i][j] = {visits: [], available: 0, planUse: 0, resourceType: jobOptions[j].resourceType as ResourceConstant};
                // save plan for later claiming in the next while loop.
                taskMatrix[i][j] = this.findBestTaskForJob(jobOptions[j], simDwarf, simStores[i], simPos[i], plannedSources, {i, j});
            }
        }
        const dwarfTimes = dwarfOptions.map(dwarf => 0);
        const timeFactor = 50;
        // condition is just a check before starting the loop
        while((dwarfOptions.length !== 0 && jobOptions.length !== 0 && Game.cpu.bucket > 20)){
            this.normalizeTaskMatrix(taskMatrix);
            for(let i = 0; i < taskMatrix.length; i++){
                const adjustment = ((timeFactor-dwarfTimes[i])/timeFactor)
                for(let j = 0; j < taskMatrix[0].length; j++){
                    // apply time factor penalty to all tasks, so we pick the best one considering time.
                    taskMatrix[i][j].normalized = taskMatrix[i][j].normalized * adjustment;
                }
            }

            // pick best task.
            const best = this.findBestTaskCoords(taskMatrix);
            if(best.i === -1 || best.j === -1) break;

            const chosenDwarf = dwarfOptions[best.i];
            const chosenJob = jobOptions[best.j];
            econTasks[chosenJob.type].claim(chosenDwarf, Game.getObjectById(chosenDwarf.id) as Creep, chosenJob, taskMatrix[best.i][best.j].amount);
            dwarfTimes[best.i] += taskMatrix[best.i][best.j].time;
            // updated simstore AND simpos goes here!
            simPos[best.i] = chosenJob.pos;
            const resourcePlan = plannedSources[best.i][best.j];
            // resourcePlan.planUse += taskMatrix[best.i][best.j].amount;
            simStores[best.i].used += taskMatrix[best.i][best.j].amount;
            // resourcePlan.available -= taskMatrix[best.i][best.j].amount;
            for(const visit of (resourcePlan?.visits || [])){
                const fakejob = {type:"deliver", target: visit.id, pos: g.atlas.rooms[visit.roomName].containers[visit.id].pos, amount:-visit.amount, resourceType: resourcePlan!.resourceType, priority: -1, rank:-1, tick:-1, active:-1, id:-1} as Job;
                econTasks.deliver.claim(chosenDwarf, Game.getObjectById(chosenDwarf.id)!, fakejob, -visit.amount, resourcePlan!.resourceType);
                const moveTask = chosenDwarf.commands.pop()!;
                chosenDwarf.commands.unshift(moveTask);
            }
            // recalculate
            for(let i = 0; i < dwarfOptions.length; i++){
                for(let j = 0; j < jobOptions.length; j++){
                    for(const source of plannedSources[i][j]?.visits || []){
                        if((g.atlas.rooms[source.roomName]?.containers[source.id]?.store[(plannedSources[i][j]?.resourceType||RESOURCE_ENERGY)] || -1) <= source.amount){
                            plannedSources[i][j] = undefined;
                            const simDwarf = dwarfOptions[i]
                            taskMatrix[i][j] = this.findBestTaskForJob(jobOptions[j], simDwarf, simStores[i], simPos[i], plannedSources, {i, j});
                            continue;
                        }
                    }
                    if(i === best.i || j === best.j) {
                        plannedSources[i][j] = undefined;
                        const simDwarf = dwarfOptions[i]
                        taskMatrix[i][j] = this.findBestTaskForJob(jobOptions[j], simDwarf, simStores[i], simPos[i], plannedSources, {i, j});
                        continue
                    }
                }
            }
            if(dwarfTimes.some(time => time < 1)) continue;
            break;
        }
    }
    private updateTasks() {
        const cpuStart = Game.cpu.getUsed();
        for (const dwarf of this.dwarves.filter(d => d.role !== "mobileDelver")) {
            this.removeDwarfTasks(dwarf);
        }
        for (const dwarf of this.dwarves.filter(d => d.role === "mobileDelver")) {
            const job = this.jobs.find(j => j.id === dwarf.commands[0]?.jobId);
            if (!job || job.type !== "delve" || job.active < job.amount) {
                this.removeDwarfTasks(dwarf);
            }
        }

        this.assignDelveTasks();
        this.assignWorkerTasks();
        g.hud.addText('', `assign tasks cpu: ${Game.cpu.getUsed() - cpuStart}`);

    }
    private removeDwarfTasks(dwarf: Dwarf) {
        while (dwarf.commands.length > 0) {
            econTasks[dwarf.commands[0].type].complete(dwarf, this.jobs, false);
        }
    }
    public run() {
        let tasksUpdated = false;

        for (const job of this.jobs) {
            const text: string[] = []
            console.log(`job length: ${this.jobs.length}`)
            for(const key in job){
                if(key === "pos") continue;
                if(key === "id") continue;
                if(key === "target") continue;
                if(job[key as keyof Job] === "energy") continue;
                if(key === "tick") continue

                let val: any = job[key as keyof Job]
                if(typeof val === "number"){
                    const valTest = val.toFixed(2);
                    if(valTest.length < val.toString().length) val = valTest;
                }
                text.push(`${key.substring(0,3)}: ${JSON.stringify(val)}`);
            }
            g.hud.makeElement(`${job.id}`, job.pos, text, undefined, {scale: "small"});
        }

        for (const dwarf of this.dwarves) {
            const creep = Game.getObjectById(dwarf.id);
            if (!creep) {
                dwarf.info.remove = true;
                continue;
            }
            dwarf.info.working = false;

            g.hud.makeElement(`dwarf${dwarf.id}`, creep.pos, undefined, undefined, {line: true, scale: "small"})

            // can work on 2 tasks per tick, ie work on one, move towards the next.
            for(let i = 0; i < 2; i++){
                if(dwarf.commands.length === 0 && !tasksUpdated && Game.cpu.bucket > 100){
                    this.updateTasks();
                    g.hud.addText('', "updated tasks")
                    tasksUpdated = true;
                }
                if (dwarf.commands.length === 0) {
                    creep.say("❌🛠", true)
                    continue;
                }
                let resolveTask;
                const command = dwarf.commands[0];
                if (econTasks[command.type]) resolveTask = econTasks[command.type].do(dwarf, creep);
                else console.log("unknown econ work task type");

                g.hud.addText(`dwarf${dwarf.id}`, `${JSON.stringify(resolveTask)}`)
                g.hud.addText(`dwarf${dwarf.id}`, `${JSON.stringify(command)}`)

                if(resolveTask === undefined) break;
                econTasks[command.type].complete(dwarf, this.jobs, true);
            }

            for(const command of dwarf.commands){
                g.hud.addSecondaryPoint(`dwarf${dwarf.id}`, command.pos);
            }
        }
    }
    public assignCreep(creep: Creep, role: string): boolean {
        role = this._memberTypes[role];
        if (!role) return false;

        const newDwarf: Dwarf = {
            role,
            id: creep.id,
            commands: [],
            info: {
                remove: false,
                workParts: creep.getActiveBodyparts(WORK),
                carryParts: creep.getActiveBodyparts(CARRY),
                spawnCost: creep.body.reduce((cost, part) => cost + BODYPART_COST[part.type], 0),
                cargo: {},
                working: false
            }
        }
        if(newDwarf.info.carryParts > 0){
            for(const resourceType in creep.store){
                newDwarf.info.cargo[resourceType as ResourceConstant] = creep.store[resourceType as ResourceConstant];
            }
        }
        this.dwarves.push(newDwarf);
        return true;
    }
    public updateJobs(): number {
        let score = 0.1;
        const currentJobs = new Set(this.jobs.map(job => job.id));
        this.jobs = g.jobBoard.UpdateEconWorkPartJobs(this.jobs);
        const newJobs = this.jobs.filter(job => !currentJobs.has(job.id));
        score += newJobs.length;
        return score;
    }
}

const creepHandler = new CreepHandler();
creepHandler.registerForeman(new EconWorkForeman());

export { creepHandler };
export type { Dwarf, Command };

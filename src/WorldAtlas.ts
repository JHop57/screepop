//import Tools from "utils/Tools";

import { Tools } from "utils/Tools";
import { MY_NUMS } from "JobBoard";

type RoomsAtlas = {
  [key: string]: RoomEntry;
};
type RoomEntry = {
  routes: { [key: string]: CostMatrix };
  terrain: CostMatrix;
  terrainDate: number;
  sources: { [key: Id<Source>]: SourceEntry };
  minerals: { [key: Id<Mineral>]: MineralEntry };
  containers: { [key: Id<AnyStoreStructure>|Id<Resource>|Id<Tombstone>|Id<Ruin>]: ContainerEntry };
  foreignPresence: { [key: string]: number };
  control: number;
  updated: boolean;
  carveSites?: { [key: Id<ConstructionSite>]: CarveSite };
  wallGoal?: number;
};
type SourceEntry = {
  readonly pos: Pos;
  regenRate: number;
  access: number;
  departureTime: number;
  container?: Id<AnyStoreStructure>;
};
type MineralEntry = {
  readonly pos: Pos;
  access: number;
  type: MineralConstant;
  departureTime: number;
  container?: Id<AnyStoreStructure>;
};
type ContainerEntry = {
  readonly pos: Pos;
  active: number;
  rank: number;
  store: SimpleStore;
  max: number;
};
type ContainerAdd = {
  roomId: string;
  containerId: Id<AnyStoreStructure>;
  amount: number;
  type: ResourceConstant;
};
type CarveSite = {
  readonly pos: Pos;
  readonly type: BuildableStructureConstant;
  remaining: number;
};

enum CtrlLvl {
  foreign = -2,
  contested = -1,
  unclaimed = 0,
  tentative = 1,
  reserved = 2,
  colonized = 3,
  stronghold = 4
}

class WorldAtlas {
  public rooms: RoomsAtlas = this.ReadMem();
  private containerAdd: ContainerAdd[] = [];

  private ReadMem() {
    let rooms: RoomsAtlas = Memory.worldAtlas || {};

    for (let roomId in rooms) {
      let room = rooms[roomId];
      room.terrain = PathFinder.CostMatrix.deserialize(Memory.worldAtlas[roomId].terrain || []);
      for (let route in room.routes) {
        room.routes[route] = PathFinder.CostMatrix.deserialize(Memory.worldAtlas[roomId].routes[route] || []);
      }
    }

    return rooms;
  }
  public WriteMem() {
    Memory.worldAtlas = {};

    for (let roomId in this.rooms) {
      let room = this.rooms[roomId];
      Memory.worldAtlas[roomId] = {
        sources: room.sources,
        minerals: room.minerals,
        containers: room.containers,
        foreignPresence: room.foreignPresence,
        control: room.control,
        updated: room.updated,
        carveSites: room.carveSites,
        wallGoal: room.wallGoal
      };
      //not writing pathfinding, save on mem. revisit when traffic managment done
      /*for (let route in room.routes) {
        Memory.worldAtlas[roomId].routes[route] = room.routes[route].serialize();
      }*/
    }
  }

  public SurveyRoom(roomId: string){
    if(!Game.rooms[roomId]) return false

    if(!this.rooms[roomId]) return this.InitialRoomSurvey(roomId)

    return this.UpdateRoomSurvey(roomId)
  }
  private InitialRoomSurvey(roomId: string): boolean {
    let room = Game.rooms[roomId]

    let roomEntry:RoomEntry = {
      routes: {},
      terrain: new PathFinder.CostMatrix(),
      terrainDate: 0,
      sources: {},
      minerals: {},
      containers: {},
      foreignPresence: {},
      control: CtrlLvl.unclaimed,
      updated: true
    };

    //handle sources
    let terrain = room.getTerrain()
    let rawSources = room.find(FIND_SOURCES);
    for (let item of rawSources) {
      //tally up spaces that are not walls surrounding a source: get max num of harvesters
      let space = 0;
      for (let direction of Tools.DIRECTIONS){
        let testPos = Tools.getOffset(item.pos, direction);
        if (terrain.get(testPos.x, testPos.y) != TERRAIN_MASK_WALL) { //does not account for structures
            space++;
          }
      }
      roomEntry.sources[item.id] = {
        pos: {x: item.pos.x, y: item.pos.y , roomName: item.pos.roomName},
        regenRate: item.energyCapacity / 300,
        access: space,
        departureTime: 0
      };
    }

    //handle minerals
    let rawMinerals = room.find(FIND_MINERALS)
    for (let item of rawMinerals) {
      //tally up spaces that are not walls surrounding a source, get max num of harvesters
      let space = 0;
      for (let direction of Tools.DIRECTIONS){
        let testPos = Tools.getOffset(item.pos, direction);
        if (terrain.get(testPos.x, testPos.y) != TERRAIN_MASK_WALL) { //does not account for structures
            space++;
          }
      }
      roomEntry.minerals[item.id] = {
        pos: {x: item.pos.x, y: item.pos.y , roomName: item.pos.roomName},
        access: space,
        type: item.mineralType,
        departureTime: 0
      };
    }

    this.rooms[roomId] = roomEntry

    let result = true;
    result = this.UpdateRoomSurvey(roomId)
    return result;
  }

  private UpdateRoomSurvey(roomId: string) {
    let room = Game.rooms[roomId]
    let roomAtlas = this.rooms[roomId]
    if(!roomAtlas) return false;

    //Contsruction sites
    let constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
    let carveSites: { [key: Id<ConstructionSite>]: CarveSite } = roomAtlas.carveSites || {};
    for(let siteId in carveSites){
      if (constructionSites.some(s => s.id == siteId)){
        continue;
      }
      delete carveSites[siteId as Id<ConstructionSite>]
    }

    for(let site of constructionSites){
      if(carveSites[site.id]){
        carveSites[site.id].remaining = site.progressTotal - site.progress
      } else {
        carveSites[site.id] = {
          pos: {x: site.pos.x, y: site.pos.y , roomName: site.pos.roomName},
          type: site.structureType,
          remaining: site.progressTotal - site.progress
        }
      }
    }

    //containers
    let containers: (AnyStoreStructure|Tombstone|Ruin)[] = room.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE});
    let containerEntries = roomAtlas.containers || {};
    for(let container of containers){
      if(containerEntries[container.id]) continue;

      containerEntries[container.id] = {
        pos: {x: container.pos.x, y: container.pos.y , roomName: container.pos.roomName},
        active: 0,
        rank: MY_NUMS.DISTRIBUTED_BUFFER_RANK,
        store: container.store,
        max: container.store.getCapacity() || 0
      }

      for(let sourceId in roomAtlas.sources){
        let source = roomAtlas.sources[sourceId as Id<Source>];
        if(Tools.maxDistance(container.pos, source.pos) > 1 || !(container instanceof StructureContainer)) continue;

        source.container = container.id;
        containerEntries[container.id].rank = MY_NUMS.STABLE_SOURCE_RANK;
        break;
      }
      for(let mineralId in roomAtlas.minerals){
        let mineral = roomAtlas.minerals[mineralId as Id<Mineral>];
        if(Tools.maxDistance(container.pos, mineral.pos) > 1 || !(container instanceof StructureContainer)) continue;

        mineral.container = container.id;
        containerEntries[container.id].rank = MY_NUMS.STABLE_SOURCE_RANK;
        break;
      }

      if(container instanceof StructureStorage && container.structureType == STRUCTURE_STORAGE){
        containerEntries[container.id].rank = MY_NUMS.CENTRAL_BUFFER_RANK;
      } else if(container instanceof Tombstone || container instanceof Ruin){
        containerEntries[container.id].rank = MY_NUMS.UNSTABLE_SOURCE_RANK;
      }
    }

    let resourcePiles = room.find(FIND_DROPPED_RESOURCES);
    for (let pile of resourcePiles){
      if(containerEntries[pile.id]) continue;
      containerEntries[pile.id] = {
        pos: {x: pile.pos.x, y: pile.pos.y , roomName: pile.pos.roomName},
        active: 0,
        rank: MY_NUMS.DISTRIBUTED_BUFFER_RANK,
        store: {[pile.resourceType]: pile.amount},
        max: 0
      }
    }

    let wrecks = room.find(FIND_TOMBSTONES);

    for(let containerId in containerEntries){
      let container = containers.find(c => c.id == containerId);
      if(!container){
        delete containerEntries[containerId as Id<AnyStoreStructure>]
        continue;
      }

      if(containerEntries[containerId as Id<AnyStoreStructure>].active == 0){
        containerEntries[containerId as Id<AnyStoreStructure>].store = container.store;
      }
    }

    let controller = room.controller;
    if(controller){
      if(controller.my) roomAtlas.control = CtrlLvl.colonized;
      else if(controller.reservation && controller.reservation.username == SYSTEM_USERNAME) roomAtlas.control = CtrlLvl.reserved;
      else if(controller.reservation || controller.owner?.username != "Screeps") roomAtlas.control = CtrlLvl.foreign;
    }
    return true;
  }
  public LogContainerAdd(add: ContainerAdd){
    this.containerAdd.push(add)
  }
  public doContainerAdds(){
    for(let add of this.containerAdd){
      let room = this.rooms[add.roomId]
      if(!room) continue;
      let container = room.containers[add.containerId]
      if(!container) continue;
      container.store[add.type] = (container.store[add.type] || 0) + add.amount
    }
    this.containerAdd = [];
  }
}

export {WorldAtlas, CtrlLvl};


